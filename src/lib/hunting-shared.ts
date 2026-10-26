export const MOOIR_ORIGIN = "https://mooir.ru";
export const MOOIR_ORDERS_URL = `${MOOIR_ORIGIN}/official/prikras/`;
export const MOOIR_PRICES_URL = `${MOOIR_ORIGIN}/official/predus/`;
export const MOOIR_UNITS_URL = `${MOOIR_ORIGIN}/official/raiob/`;
export const SHATURA_MAP_URL = `${MOOIR_ORIGIN}/geo/places/shaturskoe-map/`;

/** Через сколько часов страница сама просит МООиР обновиться. */
export const HUNTING_STALE_HOURS = 12;

export type HuntingKind = "order" | "price" | "contacts";

/** included — Шатура названа явно; excluded — есть список хозяйств без Шатуры; all — для всех хозяйств МООиР. */
export type ShaturaScope = "all" | "included" | "excluded";

export type HuntingStatus = "open" | "upcoming" | "closed";

export type HuntingSeasonEntry = {
  label: string;
  /** YYYY-MM-DD */
  start: string;
  end: string;
  scope: ShaturaScope;
  note: string;
  status: HuntingStatus;
  /** Дней до открытия (upcoming) или до закрытия (open). */
  days: number;
};

export type HuntingOrder = {
  id: string;
  url: string;
  title: string;
  topic: string;
  docDate: string | null;
  isNew: boolean;
  entries: HuntingSeasonEntry[];
  rules: string[];
  text: string;
};

export type HuntingPriceRow = {
  section: string;
  label: string;
  unit: string;
  /** члены / члены с собакой / спецвзнос / спецвзнос с собакой */
  prices: (number | null)[];
};

export type HuntingPriceList = {
  url: string;
  title: string;
  docDate: string | null;
  rows: HuntingPriceRow[];
  notes: string[];
};

export type HuntingLink = { label: string; url: string };

export type HuntingContacts = {
  url: string;
  lines: string[];
  links: HuntingLink[];
};

export type HuntingNowItem = HuntingSeasonEntry & {
  orderTitle: string;
  orderTopic: string;
  orderUrl: string;
};

export type HuntingOverview = {
  fetchedAt: string | null;
  today: string;
  now: HuntingNowItem[];
  orders: HuntingOrder[];
  prices: HuntingPriceList | null;
  contacts: HuntingContacts | null;
};

export type HuntingTier =
  | "member"
  | "member-dogs"
  | "fee"
  | "fee-dogs"
  | "rors"
  | "guest";

export const HUNTING_TIERS: { id: HuntingTier; label: string; hint: string }[] = [
  { id: "member", label: "Член МООиР", hint: "по членскому билету" },
  { id: "member-dogs", label: "С собакой", hint: "член МООиР, собака зарегистрирована" },
  { id: "fee", label: "Спецвзнос", hint: "оплачен спецвзнос ≥ 1000 ₽" },
  { id: "fee-dogs", label: "Спецвзнос + собака", hint: "спецвзнос и собака" },
  { id: "rors", label: "Росохотрыболовсоюз", hint: "×2 к цене для членов" },
  { id: "guest", label: "Не член", hint: "не менее ×5 к цене для членов" },
];

/** Цена для выбранной категории охотника; null — по прейскуранту не положено или «уточнить». */
export function priceForTier(prices: (number | null)[], tier: HuntingTier): number | null {
  const at = (index: number) => prices[index] ?? null;
  switch (tier) {
    case "member":
      return at(0);
    case "member-dogs":
      return at(1);
    case "fee":
      return at(2);
    case "fee-dogs":
      return at(3) ?? at(2);
    case "rors":
      return at(0) != null ? at(0)! * 2 : null;
    case "guest":
      return at(0) != null ? at(0)! * 5 : null;
  }
}

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const MONTH_RE = MONTHS.join("|");

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  apos: "'",
  shy: "",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code =
        entity[1]?.toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|tr|h\d|div|ul|ol|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/[ \t\u00a0]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function cleanCell(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

/** «от 05 августа 2026г» → 2026-08-05. */
export function findRussianDate(text: string): string | null {
  const match = new RegExp(`(\\d{1,2})\\s+(${MONTH_RE})\\s+(\\d{4})`, "iu").exec(text);
  if (!match) {
    return null;
  }
  return ymdKey(Number(match[3]), MONTHS.indexOf(match[2].toLowerCase()) + 1, Number(match[1]));
}

/** Прейскуранты отдельных хозяйств («Дмитровским РО», «в Талдомском ГО»), кроме Шатуры, не нужны. */
export function isOtherFarmPrice(title: string): boolean {
  if (/шатур/i.test(title)) {
    return false;
  }
  return /[А-ЯЁ][а-яё]+(?:-[А-ЯЁа-яё][а-яё]+)?(?:ским|ском|ское)(?![а-яё])|урочищ|участ(ок|ка)\s*№/u.test(title);
}

export function ymdKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86_400_000);
}

const RANGE_SOURCE =
  `(?<![А-Яа-яЁё])с\\s+(?:[-–—]\\s*)?(?:утренней\\s+зари\\s+)?(\\d{1,2})\\s*(?:(${MONTH_RE})\\s*)?` +
  `(?:(\\d{4})\\s*(?:года|гг\\.?|г\\.?)?\\s*)?(?:по|до)\\s+(\\d{1,2})(?:\\s*\\(\\d{1,2}\\))?\\s*(${MONTH_RE})` +
  `(?:\\s+(\\d{4}))?`;

const MARKER_RE = /^(?:\d+(?:\.\d+)*\s*\.?|[-–—•])\s*/;
const FARM_RE = /(?:^|[\s,;:])[А-ЯЁ][а-яё]+(?:\s?-\s?[А-ЯЁа-яё][а-яё]+)?ское(?=[\s,;.:–-]|$)/g;

function cleanLabel(raw: string): string {
  let label = raw
    .replace(MARKER_RE, "")
    .replace(/^руководителям[^,]*?организовать\s+/i, "")
    .replace(/^организовать\s+/i, "")
    .replace(/^(?:любительскую\s+)?(?:и\s+)?(?:спортивную\s+)?охоту\s+/i, "")
    .replace(/\s+/g, " ");
  const cut = label.search(
    /\s(?:в\s+следующих|в\s+охотхозяйствах|в\s+охотничьих\s+хозяйствах|в\s+летне-осеннем)/i,
  );
  if (cut > 0) {
    label = label.slice(0, cut);
  }
  label = label.replace(/[\s\-–—:;,]+$/, "").trim();
  return label ? label[0].toUpperCase() + label.slice(1) : "";
}

function shaturaScope(context: string): { scope: ShaturaScope; note: string } {
  const farms = context.match(FARM_RE)?.length ?? 0;
  if (/шатурск/i.test(context)) {
    const limit = /Шатурское\s*[-–—]\s*(\d+)\s*особ/i.exec(context);
    return {
      scope: "included",
      note: limit ? `Шатура: лимит ${limit[1]} ос.` : "Шатура в списке хозяйств",
    };
  }
  if (farms >= 3) {
    return { scope: "excluded", note: "Шатурского хозяйства нет в списке" };
  }
  return { scope: "all", note: "" };
}

function lineBounds(text: string, index: number): { start: number; end: number } {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const endRaw = text.indexOf("\n", index);
  return { start, end: endRaw < 0 ? text.length : endRaw };
}

/** Разбирает распоряжение: на кого и с какого по какое число. */
export function parseSeasonEntries(
  text: string,
  fallbackYear: number,
  todayKey: string,
): HuntingSeasonEntry[] {
  const lines = text.split("\n");
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const lineIndexAt = (position: number) => {
    let index = 0;
    while (index + 1 < lineStarts.length && lineStarts[index + 1] <= position) {
      index += 1;
    }
    return index;
  };

  const entries: HuntingSeasonEntry[] = [];
  const range = new RegExp(RANGE_SOURCE, "giu");
  let previousLine = -1;
  let match: RegExpExecArray | null;

  while ((match = range.exec(text))) {
    const endMonth = MONTHS.indexOf(match[5].toLowerCase()) + 1;
    const startMonth = match[2] ? MONTHS.indexOf(match[2].toLowerCase()) + 1 : endMonth;
    const endYear = match[6] ? Number(match[6]) : match[3] ? Number(match[3]) : fallbackYear;
    const startYear = match[3]
      ? Number(match[3])
      : startMonth > endMonth
        ? endYear - 1
        : endYear;
    const start = ymdKey(startYear, startMonth, Number(match[1]));
    const end = ymdKey(endYear + (match[3] && !match[6] && endMonth < startMonth ? 1 : 0), endMonth, Number(match[4]));

    const lineIndex = lineIndexAt(match.index);
    const { start: lineStart, end: lineEnd } = lineBounds(text, match.index);
    const inlineLabel = text.slice(lineStart, match.index);

    let labelLines: string[];
    if (/[А-Яа-яЁё]{3}/.test(inlineLabel.replace(MARKER_RE, ""))) {
      labelLines = [inlineLabel];
    } else {
      labelLines = [];
      for (let back = lineIndex - 1; back > previousLine && back >= lineIndex - 6; back -= 1) {
        labelLines.unshift(lines[back]);
        if (MARKER_RE.test(lines[back])) {
          break;
        }
      }
    }

    const tailLines: string[] = [text.slice(match.index + match[0].length, lineEnd)];
    for (let next = lineIndex + 1; next < lines.length && next <= lineIndex + 3; next += 1) {
      if (MARKER_RE.test(lines[next]) || new RegExp(RANGE_SOURCE, "iu").test(lines[next])) {
        break;
      }
      tailLines.push(lines[next]);
    }

    const label = cleanLabel(labelLines.join("; "));
    previousLine = lineIndex;
    if (!label) {
      continue;
    }

    const context = [...labelLines, ...tailLines].join("\n");
    const scoped = shaturaScope(context);
    const tail = tailLines
      .slice(1)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const note =
      scoped.note ||
      (tail && !/^(оформлени|в\s+квитанции)/i.test(tail)
        ? tail.length > 220
          ? `${tail.slice(0, 217).trimEnd()}…`
          : tail
        : "");

    let status: HuntingStatus;
    let days: number;
    if (todayKey < start) {
      status = "upcoming";
      days = daysBetween(todayKey, start);
    } else if (todayKey <= end) {
      status = "open";
      days = daysBetween(todayKey, end);
    } else {
      status = "closed";
      days = 0;
    }

    entries.push({ label, start, end, scope: scoped.scope, note, status, days });
  }

  return entries;
}

/** Способы, нормы добычи, документы — строки распоряжения без сроков. */
export function parseOrderRules(text: string): string[] {
  const range = new RegExp(RANGE_SOURCE, "iu");
  const rules: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length < 8 || line.length > 320 || range.test(line)) {
      continue;
    }
    if (/отч[её]т|контроль исполнения|председатель|исп(олнитель)?[:.]|тел[.:]/i.test(line)) {
      continue;
    }
    const isBullet = /^[-–—•]\s*/.test(line);
    const isNorm = /(в\s+сутки|за\s+сезон|особ(ь|ей|и)\b|без\s+ограничений|разрешенными\s+способами)/i.test(line);
    if (!isBullet && !isNorm) {
      continue;
    }
    // Строка-перечень хозяйств: оставляем только квоту Шатуры, чужие квоты боту не нужны.
    if ((line.match(FARM_RE)?.length ?? 0) >= 2) {
      const shatura = /Шатурское\s*[-–—]\s*(\d+)\s*особ/i.exec(line);
      if (shatura) {
        rules.push(`Шатурское хозяйство: квота ${shatura[1]} ос.`);
      }
      continue;
    }
    rules.push(line.replace(/^[-–—•]\s*/, "").replace(/\s+/g, " "));
    if (rules.length >= 16) {
      break;
    }
  }
  return rules;
}

/** «Об организации охоты на …» либо первый пункт распоряжения. */
export function parseOrderTopic(text: string): string {
  for (const quoted of text.matchAll(/«(Об?\s[^»]{5,220})»/gu)) {
    if (!/организац|проведени/i.test(quoted[1])) {
      continue;
    }
    const topic = quoted[1].replace(/\s+/g, " ").trim();
    return topic.includes("«") ? `${topic}»` : topic;
  }
  const first = text.split("\n").find((line) => /^1\s*\.\s/.test(line));
  if (!first) {
    return "";
  }
  const topic = cleanLabel(first);
  return topic.length > 200 ? `${topic.slice(0, 197).trimEnd()}…` : topic;
}

/** Таблица прейскуранта: разделы и строки с ценами. */
export function parsePriceRows(html: string): HuntingPriceRow[] {
  const rows: HuntingPriceRow[] = [];
  let section = "";
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(cleanCell);
    const filled = cells.filter(Boolean);
    if (filled.length === 0 || /стоимость в рублях|единицы измерения/i.test(filled.join(" "))) {
      continue;
    }
    if (filled.length === 1) {
      if (!/сезон$/i.test(filled[0])) {
        const name = filled[0]
          .replace(/\s*\(.*$/, "")
          .replace(/^\d+\s*\.\s*/, "")
          .replace(/[.,:;\s]+$/, "")
          .toLocaleLowerCase("ru-RU");
        section = name ? name[0].toLocaleUpperCase("ru-RU") + name.slice(1) : "";
      }
      continue;
    }
    if (filled.length < 3) {
      continue;
    }
    const [label, unit, ...values] = filled;
    const prices = values.slice(0, 4).map((value) => {
      const digits = value.replace(/[^\d]/g, "");
      return digits ? Number(digits) : null;
    });
    if (prices.every((price) => price == null)) {
      continue;
    }
    const normalized =
      prices.length === 3 && prices[0] == null && prices[1] == null
        ? [null, null, prices[2], null]
        : prices;
    rows.push({ section, label, unit, prices: normalized });
  }
  return rows;
}

export function parsePriceNotes(text: string): string[] {
  const start = text.search(/ПРИМЕЧАНИЯ/i);
  if (start < 0) {
    return [];
  }
  return text
    .slice(start)
    .split("\n")
    .slice(1)
    .map((line) => line.replace(/^[-–—•*\s]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 10)
    .slice(0, 14);
}
