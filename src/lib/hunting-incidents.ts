import { prisma } from "@/lib/db";
import { fetchHtml } from "@/lib/hunting";
import { escapeHtml } from "@/lib/hunting-format";
import { type TelegramUser, userName } from "@/lib/hunting-gathering";
import { htmlToText } from "@/lib/hunting-shared";
import { callTelegramApi, getTelegramChannelConfig, huntingExtraChatIds } from "@/lib/telegram";
import { formatMoscow } from "@/lib/timezone";

type Source =
  | { id: string; label: string; kind: "tg"; channel: string }
  | { id: string; label: string; kind: "regions" };

/** Местные источники Шатуры. */
const SOURCES: Source[] = [
  { id: "tg:shatoora_news", label: "Шатура без цензуры", kind: "tg", channel: "shatoora_news" },
  { id: "tg:oshatura", label: "Подслушано Шатура", kind: "tg", channel: "oshatura" },
  { id: "tg:ferralii", label: "Подслушано у водителей Шатура", kind: "tg", channel: "ferralii" },
  { id: "tg:inshatura", label: "Ленинская Шатура", kind: "tg", channel: "inshatura" },
  { id: "regions", label: "REGIONS · Шатура", kind: "regions" },
];

/** Где: лес, вода, охота. Начало слова — чтобы «колесо» не считалось лесом. */
const PLACE_RE =
  /(?<![а-яё])(?:лес(?:а|у|ом|е|ной|ном|ных|ные|ная|ную|ов|ам|ах)?(?![а-яё])|лесн|болот|торфя|озер|озёр|рек[аеиу](?![а-яё])|речк|водо[её]м|пруд|карьер|охот|рыба[кл]|рыбол|грибн|тих[ао][йя]\s+охот|егер|угодь|просек)/i;
/** Что случилось. */
const EVENT_RE =
  /спас|заблуд|пропал|ищут|поиск|утонул|утоп|тонул|провалил|под\s+л[её]д|пожар|возгоран|горит|браконьер|выстрел|застрел|ранен|ранил|погиб|труп|тело\s|напал|нападени|укус|бешен|шип|прокол|проколол|пробил|колёс|колес|украл|кража|обокрал|вскрыл|разбил|застрял|эвакуир|сбил\s+(?:лос|кабан)|медвед/i;

const MAX_AGE_DAYS = 3;
const DUPLICATE_DAYS = 7;
const TEXT_IN_MESSAGE = 900;

type Found = { source: Source; url: string; text: string; publishedAt: Date };

export function isIncident(text: string): boolean {
  return PLACE_RE.test(text) && EVENT_RE.test(text);
}

function fingerprint(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/ё/g, "е")
    .match(/[а-я]{5,}/g);
  return [...new Set((words ?? []).map((word) => word.slice(0, 6)))].slice(0, 60).join(" ");
}

function similar(a: string, b: string): boolean {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (left.size < 4 || right.size < 4) {
    return false;
  }
  let common = 0;
  for (const word of left) {
    if (right.has(word)) common += 1;
  }
  return common / Math.min(left.size, right.size) >= 0.5;
}

async function readTelegram(source: Extract<Source, { kind: "tg" }>): Promise<Found[]> {
  const html = await fetchHtml(`https://t.me/s/${source.channel}`);
  const chunks = html.split('data-post="').slice(1);
  if (chunks.length === 0) {
    throw new Error(`t.me/${source.channel}: посты не найдены`);
  }
  const found: Found[] = [];
  for (const chunk of chunks) {
    const post = chunk.slice(0, chunk.indexOf('"'));
    const body = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(chunk)?.[1];
    const time = /<time[^>]*datetime="([^"]+)"/.exec(chunk)?.[1];
    if (!body || !time) {
      continue;
    }
    found.push({
      source,
      url: `https://t.me/${post}`,
      text: htmlToText(body.replace(/<br\s*\/?>/gi, "\n")).trim(),
      publishedAt: new Date(time),
    });
  }
  return found;
}

async function readRegions(source: Extract<Source, { kind: "regions" }>): Promise<Found[]> {
  const html = await fetchHtml("https://regions.ru/shatura");
  const items = [
    ...html.matchAll(
      /<a href="(\/shatura\/[^"]+)"><div class="gfxtdi1">[\s\S]*?<h2 class="gfxtdi6">([^<]+)<\/h2>[\s\S]*?dateTime="([^"]+)"/g,
    ),
  ];
  if (items.length === 0) {
    throw new Error("regions.ru: лента Шатуры не разобрана");
  }
  return items.map(([, href, title, time]) => ({
    source,
    url: `https://regions.ru${href}`,
    text: htmlToText(title).trim(),
    publishedAt: new Date(time.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")),
  }));
}

export function huntingAdminId(): string {
  return (process.env.TELEGRAM_HUNTING_ADMIN_ID ?? "").trim().replace(/^"|"$/g, "");
}

export type IncidentsCollectResult = { checked: number; queued: number; errors: string[] };

/** Обходит местные каналы, подозрительное — модератору в личку с кнопками. Первый проход источника только запоминает. */
export async function collectIncidents(now = new Date()): Promise<IncidentsCollectResult> {
  const errors: string[] = [];
  let checked = 0;
  let queued = 0;

  for (const source of SOURCES) {
    let found: Found[];
    try {
      found = source.kind === "tg" ? await readTelegram(source) : await readRegions(source);
    } catch (error) {
      errors.push(`${source.label}: ${error instanceof Error ? error.message : "ошибка"}`);
      continue;
    }
    checked += found.length;

    const initKey = `incidents-init:${source.id}`;
    const isFirstRun = !(await prisma.huntingNotice.findUnique({ where: { key: initKey } }));
    for (const item of found) {
      if (now.getTime() - item.publishedAt.getTime() > MAX_AGE_DAYS * 86_400_000 || !isIncident(item.text)) {
        continue;
      }
      if (await prisma.huntingIncident.findUnique({ where: { url: item.url }, select: { id: true } })) {
        continue;
      }
      const print = fingerprint(item.text);
      const recent = await prisma.huntingIncident.findMany({
        where: { publishedAt: { gte: new Date(now.getTime() - DUPLICATE_DAYS * 86_400_000) } },
        select: { fingerprint: true },
      });
      const duplicate = recent.some((row) => similar(row.fingerprint, print));
      const incident = await prisma.huntingIncident.create({
        data: {
          url: item.url,
          source: source.id,
          sourceLabel: source.label,
          text: item.text.slice(0, 4000),
          publishedAt: item.publishedAt,
          status: isFirstRun ? "seen" : duplicate ? "skipped" : "pending",
          fingerprint: print,
        },
      });
      if (incident.status === "pending" && (await askModerator(incident))) {
        queued += 1;
      }
    }
    if (isFirstRun) {
      await prisma.huntingNotice.create({ data: { key: initKey } });
    }
  }
  return { checked, queued, errors };
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

async function askModerator(incident: { id: string; text: string; url: string; sourceLabel: string }): Promise<boolean> {
  const adminId = huntingAdminId();
  if (!adminId) {
    return false;
  }
  const sent = await callTelegramApi<{ message_id: number }>("hunting", "sendMessage", {
    chat_id: adminId,
    text: [
      `🔎 <b>Возможное происшествие</b> · ${escapeHtml(incident.sourceLabel)}`,
      "",
      escapeHtml(clip(incident.text, TEXT_IN_MESSAGE)),
      "",
      `<a href="${escapeHtml(incident.url)}">Оригинал</a>`,
    ].join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📢 В чаты", callback_data: `inc:${incident.id}:pub` },
          { text: "⏭ Пропустить", callback_data: `inc:${incident.id}:skip` },
        ],
      ],
    },
  });
  if (sent.ok && sent.result) {
    await prisma.huntingIncident.update({ where: { id: incident.id }, data: { adminMessageId: sent.result.message_id } });
  }
  return sent.ok;
}

/** Все охотничьи чаты: основной (с топиком) и дополнительные. */
function huntingTargets(): { chatId: string; threadId: number | null }[] {
  const config = getTelegramChannelConfig("hunting");
  const targets = config.chatId ? [{ chatId: config.chatId, threadId: config.threadId }] : [];
  for (const chatId of huntingExtraChatIds()) {
    if (!targets.some((target) => target.chatId === chatId)) {
      targets.push({ chatId, threadId: null });
    }
  }
  return targets;
}

/** Текст (или фото с подписью) во все охотничьи чаты. Возвращает, в сколько чатов дошло. */
async function broadcast(html: string, photoFileId?: string): Promise<number> {
  let delivered = 0;
  for (const target of huntingTargets()) {
    const thread = target.threadId != null ? { message_thread_id: target.threadId } : {};
    const result = photoFileId
      ? await callTelegramApi("hunting", "sendPhoto", {
          chat_id: target.chatId,
          photo: photoFileId,
          caption: html.slice(0, 1024),
          parse_mode: "HTML",
          ...thread,
        })
      : await callTelegramApi("hunting", "sendMessage", {
          chat_id: target.chatId,
          text: html.slice(0, 4000),
          parse_mode: "HTML",
          disable_web_page_preview: true,
          ...thread,
        });
    if (result.ok) {
      delivered += 1;
    } else {
      console.error("hunting broadcast", target.chatId, result.error);
    }
  }
  return delivered;
}

/** Кнопки модератора «В чаты / Пропустить». */
export async function handleIncidentCallback(query: { id: string; data?: string; from: TelegramUser }): Promise<void> {
  const match = /^inc:([^:]+):(pub|skip)$/.exec(query.data ?? "");
  const answer = (text: string) =>
    callTelegramApi("hunting", "answerCallbackQuery", { callback_query_id: query.id, text });
  if (!match || String(query.from.id) !== huntingAdminId()) {
    await answer("Решает модератор");
    return;
  }
  const incident = await prisma.huntingIncident.findUnique({ where: { id: match[1] } });
  if (!incident || incident.status !== "pending") {
    await answer("Уже обработано");
    return;
  }
  const publish = match[2] === "pub";
  let delivered = 0;
  if (publish) {
    delivered = await broadcast(
      [
        "🚨 <b>Происшествие в Шатуре</b>",
        "",
        escapeHtml(clip(incident.text, TEXT_IN_MESSAGE)),
        "",
        `Источник: <a href="${escapeHtml(incident.url)}">${escapeHtml(incident.sourceLabel)}</a>`,
      ].join("\n"),
    );
  }
  await prisma.huntingIncident.update({
    where: { id: incident.id },
    data: { status: publish ? "published" : "skipped" },
  });
  await answer(publish ? `Отправлено в чаты: ${delivered}` : "Пропущено");
  if (incident.adminMessageId) {
    await callTelegramApi("hunting", "editMessageReplyMarkup", {
      chat_id: huntingAdminId(),
      message_id: incident.adminMessageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: publish ? `✅ В чатах (${delivered})` : "⏭ Пропущено", callback_data: "inc:done" }],
        ],
      },
    });
  }
}

export const WARNING_USAGE = [
  "⚠️ Предупредить все охотничьи чаты:",
  "/vnimanie шипы на площадке у Кервы, проверяйте колёса",
  "",
  "Можно фото: отправьте снимок с подписью, начинающейся с /vnimanie.",
].join("\n");

const WARNINGS_PER_DAY = 3;
const MEMBER_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

async function isHuntingMember(userId: number): Promise<boolean> {
  for (const target of huntingTargets()) {
    const member = await callTelegramApi<{ status: string }>("hunting", "getChatMember", {
      chat_id: target.chatId,
      user_id: userId,
    });
    if (member.ok && member.result && MEMBER_STATUSES.has(member.result.status)) {
      return true;
    }
  }
  return false;
}

/** /vnimanie: предупреждение от охотника во все чаты. Возвращает ответ отправителю. */
export async function sendHunterWarning(input: {
  from: TelegramUser;
  chatId: number;
  isHuntingChat: boolean;
  text: string;
  photoFileId?: string;
  messageId?: number;
}): Promise<string> {
  const text = input.text.trim();
  if (text.length < 5) {
    return WARNING_USAGE;
  }
  if (!input.isHuntingChat && !(await isHuntingMember(input.from.id))) {
    return "Предупреждения рассылают только участники охотничьих чатов.";
  }
  const since = new Date(Date.now() - 86_400_000);
  const today = await prisma.huntingIncident.count({
    where: { source: "hunter", url: { startsWith: `hunter:${input.from.id}:` }, createdAt: { gte: since } },
  });
  if (today >= WARNINGS_PER_DAY) {
    return `Не больше ${WARNINGS_PER_DAY} предупреждений в сутки — если срочно, напишите в чат напрямую.`;
  }

  const now = new Date();
  const name = userName(input.from);
  const html = [
    "⚠️ <b>Внимание, охотники!</b>",
    "",
    escapeHtml(clip(text, 3000)),
    "",
    `— ${escapeHtml(name)}, ${formatMoscow(now, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
  ].join("\n");
  const delivered = await broadcast(html, input.photoFileId);
  await prisma.huntingIncident.create({
    data: {
      url: `hunter:${input.from.id}:${input.chatId}:${input.messageId ?? now.getTime()}`,
      source: "hunter",
      sourceLabel: name,
      text: text.slice(0, 4000),
      publishedAt: now,
      status: "published",
      fingerprint: fingerprint(text),
    },
  });
  return delivered > 0 ? `Разослал в охотничьи чаты: ${delivered}.` : "Не удалось разослать — попробуйте позже.";
}
