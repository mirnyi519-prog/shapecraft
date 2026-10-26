import { prisma } from "@/lib/db";
import { fetchHtml } from "@/lib/hunting";
import { escapeHtml } from "@/lib/hunting-format";
import { decodeEntities, ymdKey } from "@/lib/hunting-shared";
import { sendTelegramMessage } from "@/lib/telegram";
import { moscowYmd } from "@/lib/timezone";

const PRAVO_ORIGIN = "http://publication.pravo.gov.ru";
/** Губернатор МО — карантины по АЧС и бешенству; Минсельхоз МО — по остальным болезням животных. */
const PRAVO_AUTHORITIES = [
  "09a3e723-66bc-4e22-ad05-701fea4ebac9",
  "7b376f6c-b53e-4fd1-8f47-5759f4654838",
];
const MOSOBLLES_NEWS_URL = "https://mosoblles.ru/press-center/";
const MOSOBLLES_ORIGIN = "https://mosoblles.ru";

const SHATURA_RE = /Шатур|Рошал/i;
const QUARANTINE_RE = /ограничительн[а-яё]*\s+мероприяти[а-яё]*\s*\(карантин/i;
const FOREST_RE =
  /(?:ограничени|запрет)[а-яё]*\s+(?:на\s+)?(?:пребывани|посещени)|пребывани[а-яё]*\s+(?:граждан\s+)?в\s+леса/i;
/** Ограничения по всей области публикует аппарат управления; по Шатуре — Шатурский филиал. */
const FOREST_SCOPE_RE = /Шатур|Подмоск|Московской\s+област|всей\s+территори|аппарат\s+управления/i;

export type AlertKind = "quarantine" | "forest";
export type Disease = "asf" | "rabies" | "other";

type FoundAlert = {
  url: string;
  kind: AlertKind;
  disease: Disease | "";
  action: "set" | "cancel";
  title: string;
  date: string;
};

function diseaseOf(title: string): Disease | null {
  if (/африканск[а-яё]*\s+чум[а-яё]*\s+свин|АЧС/i.test(title)) return "asf";
  if (/бешенств/i.test(title)) return "rabies";
  if (/туляреми|заразной\s+болезни\s+животных|гриппа?\s+птиц|чум[а-яё]*\s+(?:плотоядных|мелких)/i.test(title)) {
    return "other";
  }
  return null;
}

type PravoItem = { eoNumber: string; complexName: string; publishDateShort: string };

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function collectQuarantines(): Promise<FoundAlert[]> {
  const found: FoundAlert[] = [];
  for (const authority of PRAVO_AUTHORITIES) {
    const data = await fetchJson<{ items?: PravoItem[] }>(
      `${PRAVO_ORIGIN}/api/Documents?SignatoryAuthorityId=${authority}&PageSize=30&Index=1&SortedBy=4&SortDestination=1`,
    );
    if (!Array.isArray(data.items)) {
      throw new Error("pravo.gov.ru: неожиданный ответ");
    }
    for (const item of data.items) {
      const title = item.complexName.replace(/\s+/g, " ").trim();
      const disease = diseaseOf(title);
      if (!disease || !QUARANTINE_RE.test(title) || !SHATURA_RE.test(title)) {
        continue;
      }
      const action = /[о0]б\s+отмене/i.test(title) ? "cancel" : /[о0]б\s+установлени/i.test(title) ? "set" : null;
      if (!action) {
        continue;
      }
      found.push({
        url: `${PRAVO_ORIGIN}/document/${item.eoNumber}`,
        kind: "quarantine",
        disease,
        action,
        title,
        date: item.publishDateShort.slice(0, 10),
      });
    }
  }
  return found;
}

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];

/** «23 октября» без года — год текущий, если месяц ещё не наступил — прошлый. */
function newsDate(value: string): string {
  const match = /(\d{1,2})\s+([а-яё]+)/i.exec(value);
  const ymd = moscowYmd();
  if (!match) {
    return ymdKey(ymd.year, ymd.month, ymd.day);
  }
  const word = match[2].toLowerCase();
  const month = MONTHS.findIndex((stem) => (stem === "ма" ? /^ма[йя]$/.test(word) : word.startsWith(stem))) + 1;
  if (month === 0) {
    return ymdKey(ymd.year, ymd.month, ymd.day);
  }
  return ymdKey(month > ymd.month ? ymd.year - 1 : ymd.year, month, Number(match[1]));
}

async function collectForest(): Promise<FoundAlert[]> {
  const html = await fetchHtml(MOSOBLLES_NEWS_URL);
  const items = [
    ...html.matchAll(
      /<span class="news-date">([^<]+)<\/span><br>\s*<span class="filial">([^<]*)<\/span>\s*<p><a href="([^"]+)" class="news-title">([^<]+)<\/a>/g,
    ),
  ];
  if (items.length === 0) {
    throw new Error("Мособллес: лента новостей не разобрана");
  }
  const found: FoundAlert[] = [];
  for (const [, date, filial, href, rawTitle] of items) {
    const title = decodeEntities(rawTitle).replace(/\s+/g, " ").trim();
    if (!FOREST_RE.test(title) || !FOREST_SCOPE_RE.test(`${filial} ${title}`)) {
      continue;
    }
    found.push({
      url: href.startsWith("http") ? href : `${MOSOBLLES_ORIGIN}${href}`,
      kind: "forest",
      disease: "",
      action: /сняты|отмен|снимают|сня(?:то|ли)/i.test(title) ? "cancel" : "set",
      title,
      date: newsDate(date),
    });
  }
  return found;
}

function alertHtml(alert: FoundAlert): string {
  const link = `<a href="${escapeHtml(alert.url)}">Документ</a>`;
  const title = escapeHtml(alert.title);
  if (alert.kind === "forest") {
    return alert.action === "cancel"
      ? ["🌲 <b>Ограничения на посещение лесов сняты</b>", title, "", link].join("\n")
      : [
          "🔥 <b>Ограничение посещения лесов</b>",
          title,
          "",
          "Пока оно действует, пребывание в лесах гослесфонда и въезд туда на машине запрещены — проверьте планы на выезд и уточните у егеря (/kontakty).",
          "",
          link,
        ].join("\n");
  }
  if (alert.action === "cancel") {
    return ["✅ <b>Карантин в Шатуре снят</b>", title, "", link].join("\n");
  }
  const heads: Record<Disease, string> = {
    asf: "🐗 <b>Карантин по АЧС в Шатуре</b>",
    rabies: "🦊 <b>Карантин по бешенству в Шатуре</b>",
    other: "⚠️ <b>Карантин по болезни животных в Шатуре</b>",
  };
  const hints: Record<Disease, string> = {
    asf: "В зоне карантина по АЧС охота на кабана загоном, нагоном и с собаками запрещена (п. 62.17 Правил охоты). Границы зоны — в документе, что разрешено — уточняйте у егеря (/kontakty).",
    rabies: "Осторожнее с лисой, енотовидной собакой и бродячими животными; собакам — действующая прививка от бешенства. Границы зоны — в документе.",
    other: "Ограничения и границы зоны — в документе; можно ли охотиться — уточняйте у егеря (/kontakty).",
  };
  const disease = (alert.disease || "other") as Disease;
  return [heads[disease], title, "", hints[disease], "", link].join("\n");
}

export type AlertsCollectResult = { found: number; added: number; errors: string[] };

/** Карантины и запреты на посещение лесов: новые — в охотничью группу. Первый проход только запоминает. */
export async function collectAlerts(): Promise<AlertsCollectResult> {
  const errors: string[] = [];
  const found: FoundAlert[] = [];
  const steps: [AlertKind, string, () => Promise<FoundAlert[]>][] = [
    ["quarantine", "карантины (pravo.gov.ru)", collectQuarantines],
    ["forest", "леса (Мособллес)", collectForest],
  ];
  const fetchedKinds: AlertKind[] = [];
  for (const [kind, label, step] of steps) {
    try {
      found.push(...(await step()));
      fetchedKinds.push(kind);
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : "ошибка"}`);
    }
  }

  let added = 0;
  for (const kind of fetchedKinds) {
    const hadData = (await prisma.huntingNotice.count({ where: { key: `alerts-init:${kind}` } })) > 0;
    const fresh = found
      .filter((alert) => alert.kind === kind)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const alert of fresh) {
      const existing = await prisma.huntingAlert.findUnique({ where: { url: alert.url }, select: { id: true } });
      if (existing) {
        continue;
      }
      await prisma.huntingAlert.create({ data: alert });
      added += 1;
      if (hadData) {
        await sendTelegramMessage(alertHtml(alert), "hunting", { html: true });
      }
    }
    if (!hadData) {
      await prisma.huntingNotice.create({ data: { key: `alerts-init:${kind}` } });
    }
  }
  return { found: found.length, added, errors };
}

export type ActiveAlert = { kind: AlertKind; disease: string; title: string; url: string; date: string };

/** Действующие карантины: по каждой болезни последний документ — «об установлении». */
export async function getActiveQuarantines(): Promise<ActiveAlert[]> {
  const rows = await prisma.huntingAlert.findMany({
    where: { kind: "quarantine" },
    orderBy: { date: "desc" },
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.disease)) {
      latest.set(row.disease, row);
    }
  }
  return [...latest.values()]
    .filter((row) => row.action === "set")
    .map((row) => ({ kind: "quarantine", disease: row.disease, title: row.title, url: row.url, date: row.date }));
}
