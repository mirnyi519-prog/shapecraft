import { prisma } from "@/lib/db";
import { fetchHtml } from "@/lib/hunting";
import { escapeHtml } from "@/lib/hunting-format";
import { type TelegramUser, userName } from "@/lib/hunting-gathering";
import { htmlToText } from "@/lib/hunting-shared";
import { callTelegramApi, getTelegramChannelConfig, huntingExtraChatIds } from "@/lib/telegram";
import { formatMoscow } from "@/lib/timezone";

type Source =
  | { id: string; label: string; kind: "tg"; channel: string; regional?: boolean }
  | { id: string; label: string; kind: "regions"; regional?: boolean };

/**
 * Источники по Шатурскому округу и соседнему Егорьевскому (охотимся у границы, под Рязановским);
 * regional — областные, из них берём только новости с местом в этих округах.
 */
const SOURCES: Source[] = [
  { id: "tg:shatoora_news", label: "Шатура без цензуры", kind: "tg", channel: "shatoora_news" },
  { id: "tg:vshature", label: "Типичная Шатура", kind: "tg", channel: "vshature" },
  { id: "tg:shatura18", label: "Подслушано Шатура 18+", kind: "tg", channel: "shatura18" },
  { id: "tg:oshatura", label: "Подслушано Шатура", kind: "tg", channel: "oshatura" },
  { id: "tg:ferralii", label: "Подслушано у водителей Шатура", kind: "tg", channel: "ferralii" },
  { id: "tg:inshatura", label: "Ленинская Шатура", kind: "tg", channel: "inshatura" },
  { id: "tg:roshaldaily", label: "Рошаль. Город-призрак", kind: "tg", channel: "roshaldaily" },
  { id: "tg:misheronsky", label: "Подслушано Мишеронский", kind: "tg", channel: "misheronsky" },
  { id: "tg:HuYegoryevsk", label: "ЧП Егорьевск", kind: "tg", channel: "HuYegoryevsk" },
  { id: "tg:gazeta_zt", label: "Знамя труда · Егорьевск", kind: "tg", channel: "gazeta_zt" },
  { id: "tg:egrsk", label: "Подсмотрено в Егорьевске", kind: "tg", channel: "egrsk" },
  { id: "regions", label: "REGIONS · Шатура", kind: "regions" },
  { id: "tg:budet_poisk", label: "ЛизаАлерт · Будет поиск", kind: "tg", channel: "budet_poisk", regional: true },
  { id: "tg:gku_mo_mosoblpojspas", label: "Мособлпожспас", kind: "tg", channel: "gku_mo_mosoblpojspas", regional: true },
  { id: "tg:mosoblles", label: "Мособллес", kind: "tg", channel: "mosoblles", regional: true },
];

export const INCIDENT_SOURCE_LABELS = SOURCES.map((source) => ({ label: source.label, regional: source.regional === true }));

/** Населённые пункты и урочища Шатурского округа и Егорьевского у границы — для областных каналов. */
const DISTRICT_RE =
  /(?<![а-яё])(?:шатур|рошал|черуст|мишерон|кривандин|туголес|дмитровск[а-яё]*\s+погост|середников|пышлиц|бакшеев|керв|северн[а-яё]*\s+грив|ярмол|осанов|харлампеев|радовиц|лузгар|пиявочн|курилов|егорьевск|рязановск|архиповск)/i;

/** Где: лес, вода, охота. Начало слова — чтобы «колесо» не считалось лесом. */
const PLACE_RE =
  /(?<![а-яё])(?:лес(?:а|у|ом|е|ной|ном|ных|ные|ная|ную|ов|ам|ах)?(?![а-яё])|лесн|болот|торфя|озер|озёр|рек[аеиу](?![а-яё])|речк|водо[её]м|пруд(?:а|у|ом|е|ы|ов|ам|ах)?(?![а-яё])|карьер(?!а|у|ой|н|ист)|охот(?!но(?![а-яё]))|рыба[кл]|рыбол|грибн|тих[ао][йя]\s+охот|егер|угодь|просек)/i;
/** Что случилось — тоже с начала слова: иначе «направленного» даёт «ранен», «спасибо» — «спас». */
const EVENT_RE =
  /(?<![а-яё])(?:спас(?!иб|ательн)|заблуд|пропал|ищут|поиск|утонул|утоп|тонул|провалил|под\s+л[её]д|пожар(?!н|оопасн)|возгоран|горит|браконьер|выстрел|застрел|ранен|ранил|погиб|труп|тело(?![а-яё])|напал|нападени|укус|бешен|шип(?!овн)|прокол|пробил|колёс|колес|украл|краж|обокрал|вскрыл|разбил|застрял|увяз|эвакуир|сбил[аи]?\s+(?:лос|кабан)|медвед|медвеж)/i;
/** Отчёты, итоги, праздники и познавательное — в них те же слова, но это не происшествие. */
const NOISE_RE =
  /(?<![а-яё])(?:подвел[аи]?\s+итог|подведены\s+итог|итоги\s+(?:деятельност|работ|года|квартал|сезон)|совещани|инвентаризац|концерт|лауреат|конкурс|фестивал|выставк|юбиле|поздравля|знаете\s+ли\s+вы|зарыблен|мальк|день\s+города|студент|будущим\s+специалист|экскурси|лекци|высад|лесовосстановлен|неликвид|санитарно-оздоровительн|противопожарн[а-яё]*\s+обустройств|минерализованн)/i;

const MAX_AGE_DAYS = 3;
const DUPLICATE_DAYS = 7;
const TEXT_IN_MESSAGE = 900;
/** Подпись к фото в Telegram — до 1024 символов вместе с шапкой и ссылкой. */
const TEXT_IN_CAPTION = 750;

/** Ручная проверка за период листает канал назад — не дальше этого числа страниц (~20 постов каждая). */
const BACKFILL_MAX_PAGES = 40;

type Found = { source: Source; url: string; text: string; publishedAt: Date; photoUrl?: string };

/** regional — пост из областного канала: нужно ещё и место в Шатурском округе. */
export function isIncident(text: string, regional = false): boolean {
  return PLACE_RE.test(text) && EVENT_RE.test(text) && !NOISE_RE.test(text) && (!regional || DISTRICT_RE.test(text));
}

function matches(source: Source, text: string): boolean {
  return isIncident(text, source.regional);
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

type TelegramPage = { found: Found[]; oldestId: number | null; oldestAt: Date | null };

/** Одна страница веб-версии канала; before — листать к постам старше этого номера. */
async function readTelegramPage(source: Extract<Source, { kind: "tg" }>, before?: number): Promise<TelegramPage> {
  const html = await fetchHtml(`https://t.me/s/${source.channel}${before ? `?before=${before}` : ""}`);
  const page: TelegramPage = { found: [], oldestId: null, oldestAt: null };
  for (const chunk of html.split('data-post="').slice(1)) {
    const post = chunk.slice(0, chunk.indexOf('"'));
    const id = Number(post.split("/")[1]);
    const time = /<time[^>]*datetime="([^"]+)"/.exec(chunk)?.[1];
    if (Number.isFinite(id) && (page.oldestId === null || id < page.oldestId)) {
      page.oldestId = id;
      page.oldestAt = time ? new Date(time) : page.oldestAt;
    }
    const body = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(chunk)?.[1];
    if (!body || !time) {
      continue;
    }
    page.found.push({
      source,
      url: `https://t.me/${post}`,
      text: htmlToText(body.replace(/<br\s*\/?>/gi, "\n")).trim(),
      publishedAt: new Date(time),
      photoUrl: /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/.exec(chunk)?.[1],
    });
  }
  return page;
}

async function readTelegram(source: Extract<Source, { kind: "tg" }>): Promise<Found[]> {
  const page = await readTelegramPage(source);
  if (page.oldestId === null) {
    throw new Error(`t.me/${source.channel}: посты не найдены`);
  }
  return page.found;
}

async function readTelegramSince(source: Extract<Source, { kind: "tg" }>, since: Date): Promise<Found[]> {
  const found: Found[] = [];
  let before: number | undefined;
  for (let index = 0; index < BACKFILL_MAX_PAGES; index++) {
    const page = await readTelegramPage(source, before);
    if (page.oldestId === null) {
      if (index === 0) throw new Error(`t.me/${source.channel}: посты не найдены`);
      break;
    }
    found.push(...page.found);
    if (!page.oldestAt || page.oldestAt < since || page.oldestId <= 1) {
      break;
    }
    before = page.oldestId;
  }
  return found.filter((item) => item.publishedAt >= since);
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

/** В ленте regions.ru картинок нет — берём og:image со страницы статьи. */
async function readArticlePhoto(url: string): Promise<string | undefined> {
  try {
    const html = await fetchHtml(url);
    return /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/.exec(html)?.[1];
  } catch {
    return undefined;
  }
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
      if (now.getTime() - item.publishedAt.getTime() > MAX_AGE_DAYS * 86_400_000 || !matches(source, item.text)) {
        continue;
      }
      if (await prisma.huntingIncident.findUnique({ where: { url: item.url }, select: { id: true } })) {
        continue;
      }
      const print = fingerprint(item.text);
      const duplicate = await hasSimilar(print, item.publishedAt);
      const status = isFirstRun ? "seen" : duplicate ? "skipped" : "pending";
      const photoUrl = status === "pending" ? await photoOf(item) : item.photoUrl;
      const incident = await prisma.huntingIncident.create({
        data: {
          url: item.url,
          source: source.id,
          sourceLabel: source.label,
          text: item.text.slice(0, 4000),
          publishedAt: item.publishedAt,
          status,
          fingerprint: print,
          photoUrl,
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

/** Уже есть похожая новость в пределах DUPLICATE_DAYS от этой; onlyShown — только показанные модератору. */
async function hasSimilar(print: string, publishedAt: Date, onlyShown = false, exceptUrl?: string): Promise<boolean> {
  const window = DUPLICATE_DAYS * 86_400_000;
  const rows = await prisma.huntingIncident.findMany({
    where: {
      publishedAt: { gte: new Date(publishedAt.getTime() - window), lte: new Date(publishedAt.getTime() + window) },
      ...(onlyShown ? { status: { in: ["pending", "published"] } } : {}),
      ...(exceptUrl ? { url: { not: exceptUrl } } : {}),
    },
    select: { fingerprint: true },
  });
  return rows.some((row) => similar(row.fingerprint, print));
}

async function photoOf(item: Found): Promise<string | undefined> {
  return item.photoUrl ?? (item.source.kind === "regions" ? await readArticlePhoto(item.url) : undefined);
}

export type IncidentsBackfillResult = {
  checked: number;
  matched: number;
  sent: number;
  duplicates: number;
  alreadyDecided: number;
  errors: string[];
};

/**
 * Ручная проверка за days дней: листает каналы назад (regions.ru — сколько есть в ленте), всё подходящее и ещё
 * не решённое — модератору. Новости, которые ждут решения, приходят заново, уже с фото.
 */
export async function backfillIncidents(days: number, now = new Date()): Promise<IncidentsBackfillResult> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const result: IncidentsBackfillResult = { checked: 0, matched: 0, sent: 0, duplicates: 0, alreadyDecided: 0, errors: [] };
  const matched: Found[] = [];
  for (const source of SOURCES) {
    try {
      const found =
        source.kind === "tg"
          ? await readTelegramSince(source, since)
          : (await readRegions(source)).filter((item) => item.publishedAt >= since);
      result.checked += found.length;
      matched.push(...found.filter((item) => matches(source, item.text)));
    } catch (error) {
      result.errors.push(`${source.label}: ${error instanceof Error ? error.message : "ошибка"}`);
    }
  }
  matched.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  result.matched = matched.length;

  for (const item of matched) {
    const existing = await prisma.huntingIncident.findUnique({ where: { url: item.url } });
    if (existing && existing.status !== "pending" && existing.status !== "seen") {
      result.alreadyDecided += 1;
      continue;
    }
    const print = fingerprint(item.text);
    if (existing?.status !== "pending" && (await hasSimilar(print, item.publishedAt, true, item.url))) {
      result.duplicates += 1;
      if (!existing) {
        await prisma.huntingIncident.create({
          data: {
            url: item.url,
            source: item.source.id,
            sourceLabel: item.source.label,
            text: item.text.slice(0, 4000),
            publishedAt: item.publishedAt,
            status: "skipped",
            fingerprint: print,
            photoUrl: item.photoUrl,
          },
        });
      } else {
        await prisma.huntingIncident.update({ where: { id: existing.id }, data: { status: "skipped" } });
      }
      continue;
    }
    const photoUrl = (await photoOf(item)) ?? existing?.photoUrl ?? undefined;
    const incident = existing
      ? await prisma.huntingIncident.update({
          where: { id: existing.id },
          data: { status: "pending", photoUrl, text: item.text.slice(0, 4000), fingerprint: print },
        })
      : await prisma.huntingIncident.create({
          data: {
            url: item.url,
            source: item.source.id,
            sourceLabel: item.source.label,
            text: item.text.slice(0, 4000),
            publishedAt: item.publishedAt,
            status: "pending",
            fingerprint: print,
            photoUrl,
          },
        });
    if (await askModerator(incident)) {
      result.sent += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return result;
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

type SentMessage = { message_id: number; photo?: { file_id: string }[] };

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Фото по ссылке; если Telegram сам не скачал (CDN каналов он часто не берёт) — качаем сами и грузим файлом.
 */
async function sendPhoto(
  payload: Record<string, unknown>,
  photoUrl: string,
): Promise<{ ok: boolean; result?: SentMessage; error?: string }> {
  const byUrl = await callTelegramApi<SentMessage>("hunting", "sendPhoto", { ...payload, photo: photoUrl });
  if (byUrl.ok) {
    return byUrl;
  }
  console.error("hunting incident photo by url", byUrl.error);
  const { token } = getTelegramChannelConfig("hunting");
  try {
    const image = await fetch(photoUrl, { signal: AbortSignal.timeout(15000) });
    const bytes = await image.arrayBuffer();
    if (!image.ok || bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) {
      return { ok: false, error: `фото не скачалось: HTTP ${image.status}, ${bytes.byteLength} B` };
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    form.set("photo", new Blob([bytes], { type: image.headers.get("content-type") ?? "image/jpeg" }), "photo.jpg");
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; result?: SentMessage; description?: string } | null;
    if (!body?.ok) {
      console.error("hunting incident photo upload", body?.description ?? response.status);
      return { ok: false, error: body?.description ?? `Telegram HTTP ${response.status}` };
    }
    return { ok: true, result: body.result };
  } catch (error) {
    console.error("hunting incident photo upload", error);
    return { ok: false, error: "фото не отправилось" };
  }
}

function shortDate(date: Date): string {
  return formatMoscow(date, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function askModerator(incident: {
  id: string;
  text: string;
  url: string;
  sourceLabel: string;
  publishedAt: Date;
  photoUrl: string | null;
  adminMessageId?: number | null;
}): Promise<boolean> {
  const adminId = huntingAdminId();
  if (!adminId) {
    return false;
  }
  const html = (limit: number) =>
    [
      `🔎 <b>Возможное происшествие</b> · ${escapeHtml(incident.sourceLabel)} · ${shortDate(incident.publishedAt)}`,
      "",
      escapeHtml(clip(incident.text, limit)),
      "",
      `<a href="${escapeHtml(incident.url)}">Оригинал</a>`,
    ].join("\n");
  const reply_markup = {
    inline_keyboard: [
      [
        { text: "📢 В чаты", callback_data: `inc:${incident.id}:pub` },
        { text: "⏭ Пропустить", callback_data: `inc:${incident.id}:skip` },
      ],
    ],
  };
  let sent = incident.photoUrl
    ? await sendPhoto({ chat_id: adminId, caption: html(TEXT_IN_CAPTION), parse_mode: "HTML", reply_markup }, incident.photoUrl)
    : null;
  if (!sent?.ok) {
    sent = await callTelegramApi<SentMessage>("hunting", "sendMessage", {
      chat_id: adminId,
      text: html(TEXT_IN_MESSAGE),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup,
    });
  }
  if (sent.ok && sent.result) {
    const fileId = sent.result.photo?.at(-1)?.file_id;
    await prisma.huntingIncident.update({
      where: { id: incident.id },
      data: { adminMessageId: sent.result.message_id, photoFileId: fileId ?? null },
    });
    if (incident.adminMessageId) {
      await callTelegramApi("hunting", "deleteMessage", { chat_id: adminId, message_id: incident.adminMessageId });
    }
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

/**
 * Текст (или фото с подписью) во все охотничьи чаты. Возвращает, в сколько чатов дошло.
 * captionHtml — короткий вариант текста под фото; если фото не ушло, шлётся полный html.
 */
async function broadcast(html: string, photo?: { fileId: string; captionHtml: string }): Promise<number> {
  let delivered = 0;
  for (const target of huntingTargets()) {
    const thread = target.threadId != null ? { message_thread_id: target.threadId } : {};
    let result = photo
      ? await callTelegramApi("hunting", "sendPhoto", {
          chat_id: target.chatId,
          photo: photo.fileId,
          caption: photo.captionHtml,
          parse_mode: "HTML",
          ...thread,
        })
      : null;
    if (!result?.ok) {
      result = await callTelegramApi("hunting", "sendMessage", {
        chat_id: target.chatId,
        text: html.slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...thread,
      });
    }
    if (result.ok) {
      delivered += 1;
    } else {
      console.error("hunting broadcast", target.chatId, result.error);
    }
  }
  return delivered;
}

export type ModerateResult = { ok: boolean; message: string };

/**
 * Решение по новости — из лички бота или из админки. «В чаты» можно и для пропущенной раньше (в т.ч. дубля),
 * «Пропустить» — только для ждущей решения.
 */
export async function moderateIncident(id: string, publish: boolean): Promise<ModerateResult> {
  const claimed = await prisma.huntingIncident.updateMany({
    where: { id, source: { not: "hunter" }, status: { in: publish ? ["pending", "skipped", "seen"] : ["pending"] } },
    data: { status: publish ? "published" : "skipped" },
  });
  const incident = await prisma.huntingIncident.findUnique({ where: { id } });
  if (!incident || claimed.count === 0) {
    return { ok: false, message: "Уже обработано" };
  }
  let delivered = 0;
  if (publish) {
    const html = (limit: number) =>
      [
        "🚨 <b>Происшествие в Шатуре</b>",
        "",
        escapeHtml(clip(incident.text, limit)),
        "",
        `Источник: <a href="${escapeHtml(incident.url)}">${escapeHtml(incident.sourceLabel)}</a>`,
      ].join("\n");
    const photo = incident.photoFileId ?? incident.photoUrl;
    delivered = await broadcast(
      html(TEXT_IN_MESSAGE),
      photo ? { fileId: photo, captionHtml: html(TEXT_IN_CAPTION) } : undefined,
    );
  }
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
  return { ok: true, message: publish ? `Отправлено в чаты: ${delivered}` : "Пропущено" };
}

/** Кнопки модератора «В чаты / Пропустить» в личке бота. */
export async function handleIncidentCallback(query: { id: string; data?: string; from: TelegramUser }): Promise<void> {
  const match = /^inc:([^:]+):(pub|skip)$/.exec(query.data ?? "");
  const answer = (text: string) =>
    callTelegramApi("hunting", "answerCallbackQuery", { callback_query_id: query.id, text });
  if (!match || String(query.from.id) !== huntingAdminId()) {
    await answer("Решает модератор");
    return;
  }
  const incident = await prisma.huntingIncident.findUnique({ where: { id: match[1] }, select: { status: true } });
  if (incident?.status !== "pending") {
    await answer("Уже обработано");
    return;
  }
  const result = await moderateIncident(match[1], match[2] === "pub");
  await answer(result.message);
}

export const INCIDENT_FILTERS = [
  { id: "pending", label: "Ждут решения" },
  { id: "published", label: "В чатах" },
  { id: "skipped", label: "Пропущены" },
  { id: "hunter", label: "От охотников" },
  { id: "all", label: "Все" },
] as const;

export type IncidentFilter = (typeof INCIDENT_FILTERS)[number]["id"];

export async function listIncidents(filter: IncidentFilter, take = 100) {
  const where =
    filter === "all"
      ? {}
      : filter === "hunter"
        ? { source: "hunter" }
        : { status: filter, source: { not: "hunter" } };
  const [items, counts] = await Promise.all([
    prisma.huntingIncident.findMany({ where, orderBy: { publishedAt: "desc" }, take }),
    prisma.huntingIncident.groupBy({
      by: ["status"],
      where: { source: { not: "hunter" } },
      _count: { _all: true },
    }),
  ]);
  const hunter = await prisma.huntingIncident.count({ where: { source: "hunter" } });
  const count = (status: string) => counts.find((row) => row.status === status)?._count._all ?? 0;
  return {
    items,
    counts: {
      pending: count("pending"),
      published: count("published"),
      skipped: count("skipped"),
      hunter,
      all: counts.reduce((sum, row) => sum + row._count._all, 0) + hunter,
    } satisfies Record<IncidentFilter, number>,
  };
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
  const html = (limit: number) =>
    [
      "⚠️ <b>Внимание, охотники!</b>",
      "",
      escapeHtml(clip(text, limit)),
      "",
      `— ${escapeHtml(name)}, ${formatMoscow(now, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
    ].join("\n");
  const delivered = await broadcast(
    html(3000),
    input.photoFileId ? { fileId: input.photoFileId, captionHtml: html(TEXT_IN_CAPTION) } : undefined,
  );
  await prisma.huntingIncident.create({
    data: {
      url: `hunter:${input.from.id}:${input.chatId}:${input.messageId ?? now.getTime()}`,
      source: "hunter",
      sourceLabel: name,
      text: text.slice(0, 4000),
      publishedAt: now,
      status: "published",
      fingerprint: fingerprint(text),
      photoFileId: input.photoFileId,
    },
  });
  return delivered > 0 ? `Разослал в охотничьи чаты: ${delivered}.` : "Не удалось разослать — попробуйте позже.";
}
