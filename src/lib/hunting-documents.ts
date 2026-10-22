import { prisma } from "@/lib/db";
import { shortDate } from "@/lib/hunting-format";
import { addDays, parseGatheringArgs } from "@/lib/hunting-gathering";
import { callTelegramApi } from "@/lib/telegram";

/** С какого часа (МСК) присылать напоминания о сроках. */
export const DOCUMENT_REMIND_HOUR = 12;

/** Через сколько дней после окончания срока документ удаляется из списка. */
const KEEP_EXPIRED_DAYS = 30;

type DocumentKind = {
  id: string;
  title: string;
  words: RegExp;
  /** За сколько дней напоминать; отрицательное — через сколько дней после окончания. */
  remind: number[];
  hint: string;
  after?: string;
};

const KINDS: DocumentKind[] = [
  {
    id: "roha",
    title: "Разрешение на оружие (РОХа)",
    words: /^(роха|рохи|rokha|roha|оружи\S*|разрешение_на_оружие)$/,
    remind: [90, 60, 30, 7, 0],
    hint:
      "Продление — через Госуслуги или ЛРР Росгвардии. Заранее нужны свежее медицинское заключение " +
      "и проверка знаний безопасного обращения с оружием. Подавайте с запасом: точный срок подачи " +
      "и перечень документов уточните на Госуслугах. Хранить и носить оружие с просроченным разрешением нельзя — /shtrafy.",
  },
  {
    id: "medsprav",
    title: "Медицинское заключение для оружия",
    words: /^(медсправк\S*|справк\S*|медзаключени\S*|medsprav)$/,
    remind: [30, 7, 0],
    hint: "Без действующего медзаключения не продлить разрешение на оружие. Оформляется в лицензированной медорганизации.",
  },
  {
    id: "putevka",
    title: "Путёвка",
    words: /^(путевк\S*|путёвк\S*|putevka)$/,
    remind: [3, 1, 0],
    hint: "Охотиться можно только в сроки путёвки. Цены — /ceny, егеря — /kontakty.",
  },
  {
    id: "razreshenie",
    title: "Разрешение на добычу",
    words: /^(разрешени\S*|razreshenie|добыч\S*)$/,
    remind: [3, 1, 0, -1],
    hint: "После окончания нужно сдать сведения о добытых охотничьих ресурсах — даже если ничего не добыто.",
    after:
      "Срок разрешения закончился. Сдайте сведения о добытых охотничьих ресурсах туда, где получали разрешение " +
      "(для разрешений МООиР — в хозяйство, /kontakty), даже если ничего не добыли. Срок сдачи уточните в хозяйстве.",
  },
];

export const DOCUMENTS_USAGE = [
  "📄 Сроки документов — бот напомнит в личке заранее.",
  "",
  "Добавить или обновить:",
  "/dokument роха 15.03.2027",
  "/dokument роха 20.05.2028 Сайга — если разрешений несколько, подпишите",
  "/dokument медсправка 01.06.2027",
  "/dokument путёвка 30.11.2026",
  "/dokument разрешение 31.12.2026 утка",
  "",
  "Удалить: /dokument удалить роха (или с подписью: /dokument удалить роха Сайга)",
  "Список: /dokumenty",
  "",
  "Когда напоминаю: РОХа — за 90, 60, 30, 7 дней и в последний день; медсправка — за 30 и 7 дней; " +
    "путёвка и разрешение на добычу — за 3 дня, накануне и в последний день, по разрешению — ещё и про сведения о добыче.",
  "Храню только тип документа, подпись и дату — без серий и номеров. В общий чат ничего не пишу.",
].join("\n");

function findKind(word: string): DocumentKind | undefined {
  const value = word.toLowerCase();
  return KINDS.find((kind) => kind.id === value || kind.words.test(value));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function daysLeftText(days: number): string {
  if (days < 0) return "срок истёк";
  if (days === 0) return "сегодня последний день";
  if (days === 1) return "завтра последний день";
  return `осталось ${days} дн.`;
}

function documentTitle(kind: DocumentKind, label: string): string {
  return label ? `${kind.title} — ${label}` : kind.title;
}

function noticeKey(id: string, expires: string, threshold: number): string {
  return `doc:${id}:${expires}:${threshold}`;
}

/** Помечает уже пройденные пороги, чтобы свежая запись не вызвала пачку запоздалых напоминаний. */
async function markPassedThresholds(id: string, kind: DocumentKind, expires: string, today: string) {
  const left = daysBetween(today, expires);
  for (const threshold of kind.remind.filter((value) => value > left)) {
    const key = noticeKey(id, expires, threshold);
    await prisma.huntingNotice.upsert({ where: { key }, create: { key }, update: {} });
  }
}

export async function listDocumentsText(userId: string, today: string): Promise<string> {
  const docs = await prisma.huntingDocument.findMany({ where: { userId }, orderBy: { expires: "asc" } });
  if (docs.length === 0) {
    return `Документов пока нет.\n\n${DOCUMENTS_USAGE}`;
  }
  const lines = ["📄 Ваши документы:"];
  for (const doc of docs) {
    const kind = KINDS.find((item) => item.id === doc.kind);
    if (!kind) continue;
    lines.push(
      `• ${documentTitle(kind, doc.label)} — до ${shortDate(doc.expires, true)} (${daysLeftText(daysBetween(today, doc.expires))})`,
    );
  }
  lines.push("", "Изменить — /dokument тип дата, удалить — /dokument удалить тип. Подробно — /dokument");
  return lines.join("\n");
}

/** Команда /dokument в личке: добавить, обновить или удалить срок. */
export async function handleDocumentCommand(userId: string, arg: string, today: string): Promise<string> {
  const words = arg.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return DOCUMENTS_USAGE;
  }

  if (/^(удалить|удали|delete|del)$/i.test(words[0])) {
    const kind = words[1] ? findKind(words[1]) : undefined;
    if (!kind) {
      return "Какой документ удалить? Например: /dokument удалить роха";
    }
    const label = words.slice(2).join(" ");
    const removed = await prisma.huntingDocument.deleteMany({
      where: { userId, kind: kind.id, ...(label ? { label } : {}) },
    });
    return removed.count > 0
      ? `Удалено: ${documentTitle(kind, label)}.`
      : `Не нашёл «${documentTitle(kind, label)}» в вашем списке — /dokumenty`;
  }

  const kind = findKind(words[0]);
  if (!kind) {
    return `Не понял тип документа «${words[0]}».\n\n${DOCUMENTS_USAGE}`;
  }
  const { date, what } = parseGatheringArgs(words.slice(1).join(" "), today);
  if (!date) {
    return `Укажите дату окончания, например: /dokument ${words[0]} 15.03.2027`;
  }
  if (date < today) {
    return `${shortDate(date, true)} уже прошло — укажите дату окончания действующего документа.`;
  }
  const label = what.slice(0, 40);
  const doc = await prisma.huntingDocument.upsert({
    where: { userId_kind_label: { userId, kind: kind.id, label } },
    create: { userId, kind: kind.id, label, expires: date },
    update: { expires: date, active: true },
  });
  await markPassedThresholds(doc.id, kind, date, today);
  const left = daysBetween(today, date);
  const lines = [
    `✅ Записал: ${documentTitle(kind, label)} — до ${shortDate(date, true)} (${daysLeftText(left)}).`,
    `Напомню ${kind.remind
      .filter((value) => value >= 0 && value <= left)
      .map((value) => (value === 0 ? "в последний день" : value === 1 ? "накануне" : `за ${value} дн.`))
      .join(", ") || "в последний день"}.`,
    "",
    kind.hint,
  ];
  return lines.join("\n");
}

/** Пользователь снова написал боту — возобновляем напоминания, если он его блокировал. */
export async function reactivateDocuments(userId: string): Promise<void> {
  await prisma.huntingDocument.updateMany({ where: { userId, active: false }, data: { active: true } });
}

function reminderText(kind: DocumentKind, label: string, expires: string, left: number): string {
  if (left < 0 && kind.after) {
    return [`📄 ${documentTitle(kind, label)} — закончилось ${shortDate(expires, true)}.`, "", kind.after].join("\n");
  }
  const when = left === 0 ? "сегодня последний день" : left === 1 ? "завтра последний день" : `через ${left} дн.`;
  return [
    `⏰ ${documentTitle(kind, label)}: ${when} — действует до ${shortDate(expires, true)}.`,
    "",
    kind.hint,
    "",
    "Обновили документ — пришлите новую дату: /dokument тип дата. Все сроки — /dokumenty",
  ].join("\n");
}

/** Проход расписания: одно напоминание на документ за раз — по самому близкому порогу. */
export async function sendDocumentReminders(today: string, hour: number): Promise<void> {
  await prisma.huntingDocument.deleteMany({ where: { expires: { lt: addDays(today, -KEEP_EXPIRED_DAYS) } } });
  if (hour < DOCUMENT_REMIND_HOUR) {
    return;
  }
  const docs = await prisma.huntingDocument.findMany({
    where: { active: true, expires: { lte: addDays(today, 90) } },
  });
  for (const doc of docs) {
    const kind = KINDS.find((item) => item.id === doc.kind);
    if (!kind) continue;
    const left = daysBetween(today, doc.expires);
    const due = kind.remind.filter((value) => left <= value);
    if (due.length === 0) continue;
    const keys = due.map((value) => noticeKey(doc.id, doc.expires, value));
    const sent = new Set(
      (await prisma.huntingNotice.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((row) => row.key),
    );
    const nearest = Math.min(...due);
    if (sent.has(noticeKey(doc.id, doc.expires, nearest))) continue;
    if (left < 0 && !kind.after) continue;

    const result = await callTelegramApi("hunting", "sendMessage", {
      chat_id: doc.userId,
      text: reminderText(kind, doc.label, doc.expires, left),
      disable_web_page_preview: true,
    });
    if (result.ok) {
      for (const key of keys) {
        await prisma.huntingNotice.upsert({ where: { key }, create: { key }, update: {} });
      }
    } else if (/blocked|deactivated|chat not found|403/i.test(result.error ?? "")) {
      await prisma.huntingDocument.updateMany({ where: { userId: doc.userId }, data: { active: false } });
    }
  }
}
