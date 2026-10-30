import { prisma } from "@/lib/db";
import { type GigaFunction, type GigaMessage, gigachatComplete, gigachatConfigured } from "@/lib/gigachat";
import { formatMoscow, startOfMoscowDay } from "@/lib/timezone";

/** Сколько последних реплик чата модель видит как контекст. */
const HISTORY = 12;
const KEEP_DAYS = 30;
const PER_USER_PER_DAY = 25;
const TOTAL_PER_DAY = 400;
/** Не больше стольких обращений к функциям бота на один вопрос. */
const MAX_FUNCTION_CALLS = 3;
const MAX_REPLY = 3500;

export type ChatTool = GigaFunction & { run: (args: Record<string, unknown>) => Promise<string> };

export function huntingChatEnabled(): boolean {
  return gigachatConfigured();
}

function systemPrompt(today: string): string {
  return [
    "Ты — бот охотничьего чата Шатурского охотхозяйства МООиР (Московская область). Сегодня " + today + ".",
    "Говоришь как опытный и дружелюбный егерь: по-русски, просто, коротко — обычно 2–6 предложений, без канцелярита.",
    "Сроки охоты, цены путёвок, контакты, погоду, законы, патроны и новости бери ТОЛЬКО из функций — вызывай их, когда вопрос об этом.",
    "Никогда не выдумывай даты, цены, телефоны, номера статей и суммы штрафов. Если в данных нет ответа — так и скажи и посоветуй уточнить у егеря (/kontakty).",
    "По законам пересказывай данные функции и давай ссылку на документ; это не юридическая консультация.",
    "На общие темы (собаки, снаряжение, приметы, рецепты дичи, байки) можно говорить свободно. На темы, далёкие от охоты и природы, отвечай кратко и возвращай разговор к охоте.",
    "Подсказывай команды бота, когда это удобно: /sezon, /ceny, /pogoda, /patron, /sbor, /kontakty, /dokumenty, /podpiska.",
    "Не используй Markdown-разметку (звёздочки, решётки) — только обычный текст и эмодзи по делу.",
  ].join("\n");
}

/** null — можно спрашивать; иначе — текст отказа. */
async function limitReason(userId: string, unlimited: boolean, now: Date): Promise<string | null> {
  if (unlimited) {
    return null;
  }
  const since = startOfMoscowDay(now);
  const [mine, total] = await Promise.all([
    prisma.huntingChatMessage.count({ where: { userId, role: "user", createdAt: { gte: since } } }),
    prisma.huntingChatMessage.count({ where: { role: "user", createdAt: { gte: since } } }),
  ]);
  if (mine >= PER_USER_PER_DAY) {
    return "На сегодня наговорились 🙂 Завтра продолжим, а пока — команды: /help";
  }
  if (total >= TOTAL_PER_DAY) {
    return "Сегодня я уже много болтал — лимит разговоров исчерпан. Команды работают как обычно: /help";
  }
  return null;
}

function cleanReply(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim()
    .slice(0, MAX_REPLY);
}

export async function huntingChatReply(input: {
  chatId: string;
  userId: string;
  name: string;
  text: string;
  isGroup: boolean;
  unlimited: boolean;
  tools: ChatTool[];
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  const limit = await limitReason(input.userId, input.unlimited, now);
  if (limit) {
    return limit;
  }

  const history = await prisma.huntingChatMessage.findMany({
    where: { chatId: input.chatId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
    orderBy: { createdAt: "desc" },
    take: HISTORY,
  });
  const asUser = (name: string, text: string) => (input.isGroup && name ? `${name}: ${text}` : text);
  const messages: GigaMessage[] = [
    { role: "system", content: systemPrompt(formatMoscow(now, { day: "numeric", month: "long", year: "numeric", weekday: "long" })) },
    ...history.reverse().map((row): GigaMessage =>
      row.role === "assistant" ? { role: "assistant", content: row.content } : { role: "user", content: asUser(row.name, row.content) },
    ),
    { role: "user", content: asUser(input.name, input.text) },
  ];

  await prisma.huntingChatMessage.create({
    data: { chatId: input.chatId, userId: input.userId, name: input.name, role: "user", content: input.text.slice(0, 2000) },
  });

  const functions = input.tools.map(({ run: _run, ...fn }) => fn);
  let tokens = 0;
  let answer = "";
  for (let step = 0; step <= MAX_FUNCTION_CALLS; step += 1) {
    const reply = await gigachatComplete(messages, step < MAX_FUNCTION_CALLS ? functions : []);
    tokens += reply.totalTokens;
    const call = reply.message.function_call;
    if (!call) {
      answer = reply.message.content;
      break;
    }
    messages.push(reply.message);
    const tool = input.tools.find((item) => item.name === call.name);
    const result = tool
      ? await tool.run(call.arguments ?? {}).catch((error) => `Ошибка: ${String(error)}`)
      : "Такой функции нет.";
    messages.push({ role: "function", name: call.name, content: JSON.stringify({ result: result.slice(0, 6000) }) });
  }

  answer = cleanReply(answer) || "Не нашёлся, что ответить 🤔 Попробуйте спросить иначе или посмотрите /help";
  await prisma.huntingChatMessage.create({
    data: { chatId: input.chatId, userId: input.userId, name: "", role: "assistant", content: answer, tokens },
  });
  return answer;
}

export async function pruneHuntingChat(now = new Date()): Promise<void> {
  await prisma.huntingChatMessage.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } },
  });
}
