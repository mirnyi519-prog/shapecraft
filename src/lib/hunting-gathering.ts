import { prisma } from "@/lib/db";
import { findAmmoSpecies, formatAmmoTip, pickAmmo, seasonForMonth } from "@/lib/hunting-ammo";
import { escapeHtml, shortDate } from "@/lib/hunting-format";
import { fetchHuntingWeather, weatherDayLines } from "@/lib/hunting-weather";
import { ymdKey } from "@/lib/hunting-shared";
import { callTelegramApi } from "@/lib/telegram";
import { moscowYmd } from "@/lib/timezone";

export type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };

type Answer = "go" | "maybe" | "no";

const ANSWERS: { id: Answer; button: string; title: string }[] = [
  { id: "go", button: "✅ Еду", title: "✅ Едут" },
  { id: "maybe", button: "🤔 Думаю", title: "🤔 Думают" },
  { id: "no", button: "❌ Не еду", title: "❌ Не едут" },
];

/** С какого часа (МСК) накануне присылать напоминание. */
export const GATHERING_REMIND_HOUR = 12;

/** Виды, где Правила охоты (п. 13) требуют сигнальную одежду в тёмное время. */
const SIGNAL_CLOTHING = /kaban|los|kosulya|olen|lan|severnyj|kabarga|ovcebyk|medved|volk|shakal|lisa/;

export function userName(user: TelegramUser): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return full || (user.username ? `@${user.username}` : `id${user.id}`);
}

export function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const WEEKDAYS: [RegExp, number][] = [
  [/^(пн|понедельник\S*)$/, 1],
  [/^(вт|вторник\S*)$/, 2],
  [/^(ср|сред\S*)$/, 3],
  [/^(чт|четверг\S*)$/, 4],
  [/^(пт|пятниц\S*)$/, 5],
  [/^(сб|суббот\S*)$/, 6],
  [/^(вс|воскресень\S*)$/, 0],
];

/** «26.10», «26.10.2026», «завтра», «сб» → ГГГГ-ММ-ДД; остальное — что за охота. */
export function parseGatheringArgs(arg: string, today: string): { date: string | null; what: string } {
  let date: string | null = null;
  const rest: string[] = [];
  for (const raw of arg.split(/\s+/).filter(Boolean)) {
    const word = raw.toLowerCase().replace(/[,.]$/, "");
    const numeric = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/.exec(word);
    if (!date && numeric) {
      const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : Number(today.slice(0, 4));
      let key = `${year}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
      if (!numeric[3] && key < today) {
        key = `${year + 1}${key.slice(4)}`;
      }
      date = Number.isNaN(Date.parse(key)) ? null : key;
      continue;
    }
    const relative = { сегодня: 0, завтра: 1, послезавтра: 2 }[word];
    if (!date && relative != null) {
      date = addDays(today, relative);
      continue;
    }
    const weekday = WEEKDAYS.find(([re]) => re.test(word))?.[1];
    if (!date && weekday != null) {
      const current = new Date(`${today}T12:00:00Z`).getUTCDay();
      date = addDays(today, (weekday - current + 7) % 7);
      continue;
    }
    rest.push(raw);
  }
  return { date, what: rest.join(" ").replace(/^на\s+/i, "").trim() };
}

type GatheringWithVotes = Awaited<ReturnType<typeof loadGathering>>;

function loadGathering(id: string) {
  return prisma.huntingGathering.findUnique({
    where: { id },
    include: { votes: { orderBy: { updatedAt: "asc" } } },
  });
}

function dateTitle(date: string): string {
  const weekday = new Date(`${date}T12:00:00+03:00`).toLocaleDateString("ru-RU", {
    weekday: "short",
    timeZone: "Europe/Moscow",
  });
  return `${weekday}, ${shortDate(date)}`;
}

export function renderGathering(gathering: NonNullable<GatheringWithVotes>): string {
  const lines = [
    "🎯 <b>Сбор на охоту</b>",
    `<b>${escapeHtml(gathering.title)}</b> · ${dateTitle(gathering.date)}`,
  ];
  if (gathering.createdBy) {
    lines.push(`Собирает: ${escapeHtml(gathering.createdBy)}`);
  }
  lines.push("");
  for (const answer of ANSWERS) {
    const names = gathering.votes.filter((vote) => vote.answer === answer.id).map((vote) => escapeHtml(vote.name));
    lines.push(`${answer.title} (${names.length}): ${names.length ? names.join(", ") : "—"}`);
  }
  lines.push("", "<i>Отметьтесь кнопкой ниже — накануне в 12:00 бот напомнит, что взять, и пришлёт погоду.</i>");
  return lines.join("\n");
}

function keyboard(id: string) {
  return { inline_keyboard: [ANSWERS.map((answer) => ({ text: answer.button, callback_data: `sbor:${id}:${answer.id}` }))] };
}

export const GATHERING_USAGE = [
  "Как собрать людей на охоту:",
  "/sbor кабан 26.10",
  "/sbor утка сб",
  "/sbor загон на лося завтра",
  "",
  "Дата — 26.10, «завтра», «сб». Под сообщением появятся кнопки «Еду / Думаю / Не еду».",
].join("\n");

/** /sbor в группе: создаёт сбор и публикует сообщение с кнопками. Возвращает текст ошибки, если что-то не так. */
export async function createGathering(input: {
  chatId: number;
  threadId: number | null;
  from: TelegramUser | undefined;
  arg: string;
  today: string;
}): Promise<string | null> {
  const { date, what } = parseGatheringArgs(input.arg, input.today);
  if (!date) {
    return GATHERING_USAGE;
  }
  if (date < input.today) {
    return "Эта дата уже прошла — укажите будущую.";
  }
  const species = what ? findAmmoSpecies(what) : undefined;
  const title = what ? `${what.charAt(0).toUpperCase()}${what.slice(1)}`.slice(0, 80) : (species?.title ?? "Охота");
  const gathering = await prisma.huntingGathering.create({
    data: {
      chatId: String(input.chatId),
      threadId: input.threadId,
      species: species?.key ?? "",
      title,
      date,
      createdBy: input.from ? userName(input.from) : "",
    },
  });
  if (input.from) {
    await prisma.huntingGatheringVote.create({
      data: { gatheringId: gathering.id, userId: String(input.from.id), name: userName(input.from), answer: "go" },
    });
  }
  const loaded = await loadGathering(gathering.id);
  const sent = await callTelegramApi<{ message_id: number }>("hunting", "sendMessage", {
    chat_id: input.chatId,
    text: renderGathering(loaded!),
    parse_mode: "HTML",
    reply_markup: keyboard(gathering.id),
    ...(input.threadId != null ? { message_thread_id: input.threadId } : {}),
  });
  if (!sent.ok || !sent.result) {
    await prisma.huntingGathering.delete({ where: { id: gathering.id } });
    return `Не удалось опубликовать сбор: ${sent.error ?? "ошибка Telegram"}`;
  }
  await prisma.huntingGathering.update({ where: { id: gathering.id }, data: { messageId: sent.result.message_id } });
  return null;
}

/** Нажатие кнопки под сбором. */
export async function handleGatheringCallback(query: {
  id: string;
  data?: string;
  from: TelegramUser;
}): Promise<void> {
  const match = /^sbor:([^:]+):(go|maybe|no)$/.exec(query.data ?? "");
  const gathering = match ? await loadGathering(match[1]) : null;
  if (!match || !gathering) {
    await callTelegramApi("hunting", "answerCallbackQuery", { callback_query_id: query.id, text: "Сбор не найден" });
    return;
  }
  const answer = match[2] as Answer;
  const userId = String(query.from.id);
  const name = userName(query.from);
  await prisma.huntingGatheringVote.upsert({
    where: { gatheringId_userId: { gatheringId: gathering.id, userId } },
    create: { gatheringId: gathering.id, userId, name, answer },
    update: { name, answer },
  });
  await callTelegramApi("hunting", "answerCallbackQuery", {
    callback_query_id: query.id,
    text: `Отмечено: ${ANSWERS.find((item) => item.id === answer)!.button}`,
  });
  const updated = await loadGathering(gathering.id);
  if (updated?.messageId) {
    await callTelegramApi("hunting", "editMessageText", {
      chat_id: updated.chatId,
      message_id: updated.messageId,
      text: renderGathering(updated),
      parse_mode: "HTML",
      reply_markup: isPast(updated.date) ? undefined : keyboard(updated.id),
    });
  }
}

function isPast(date: string): boolean {
  const ymd = moscowYmd();
  return date < ymdKey(ymd.year, ymd.month, ymd.day);
}

/** Текст напоминания накануне: кто едет, документы, патрон, погода. */
export async function buildGatheringReminder(gathering: NonNullable<GatheringWithVotes>): Promise<string> {
  const going = gathering.votes.filter((vote) => vote.answer === "go").map((vote) => escapeHtml(vote.name));
  const maybe = gathering.votes.filter((vote) => vote.answer === "maybe").map((vote) => escapeHtml(vote.name));
  const lines = [
    `⏰ <b>Завтра охота: ${escapeHtml(gathering.title)}</b> · ${dateTitle(gathering.date)}`,
    "",
    `✅ Едут (${going.length}): ${going.length ? going.join(", ") : "—"}`,
  ];
  if (maybe.length) {
    lines.push(`🤔 Ещё думают: ${maybe.join(", ")}`);
  }

  lines.push(
    "",
    "🎒 <b>Взять с собой</b> (Правила охоты, п. 5.2)",
    "• охотничий билет (бумажный или электронный)",
    "• разрешение на хранение и ношение оружия",
    "• разрешение на добычу и путёвку МООиР",
  );
  if (SIGNAL_CLOTHING.test(gathering.species)) {
    lines.push("• сигнальную одежду — в тёмное время обязательна (п. 13)");
  }

  if (gathering.species) {
    const pick = pickAmmo(gathering.species, seasonForMonth(Number(gathering.date.slice(5, 7))));
    if (pick) {
      lines.push("", "🎯 <b>Патрон</b>", `• ${escapeHtml(formatAmmoTip(pick.tip))}`, `  ${escapeHtml(pick.tip.note)}`);
    }
  }

  try {
    const day = (await fetchHuntingWeather(4)).find((item) => item.date === gathering.date);
    if (day) {
      lines.push("", ...weatherDayLines(day));
    }
  } catch {
    // без погоды напоминание всё равно полезно
  }
  lines.push("", "Удачной охоты! Цены — /ceny, егеря — /kontakty");
  return lines.join("\n");
}

/** Сборы, о которых пора напомнить: охота завтра. */
export function gatheringsForTomorrow(today: string) {
  return prisma.huntingGathering.findMany({
    where: { date: addDays(today, 1), messageId: { not: null } },
    include: { votes: { orderBy: { updatedAt: "asc" } } },
  });
}

/** Опубликованные сборы на указанные даты. */
export function gatheringsOn(dates: string[]) {
  return prisma.huntingGathering.findMany({
    where: { date: { in: dates }, messageId: { not: null } },
    orderBy: { date: "asc" },
  });
}
