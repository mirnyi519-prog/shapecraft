import {
  awaitedOrders,
  MOOIR_ORDERS_URL,
  type HuntingOverview,
  type HuntingSeasonEntry,
} from "@/lib/hunting-shared";
import { formatMoscow } from "@/lib/timezone";

/** Разметка Telegram parse_mode=HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function shortDate(key: string, withYear = false): string {
  return formatMoscow(new Date(`${key}T12:00:00+03:00`), {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

type SpeciesGroup = "birds" | "fur" | "hoofed";

const GROUPS: { id: SpeciesGroup; title: string }[] = [
  { id: "birds", title: "🦆 <b>Пернатая дичь</b>" },
  { id: "fur", title: "🐾 <b>Пушные</b> — охота на:" },
  { id: "hoofed", title: "🦌 <b>Копытные</b> — охота на:" },
];

export type HuntItem = {
  group: SpeciesGroup;
  /** Уже экранированный HTML. */
  name: string;
  details: string;
  start: string;
  end: string;
  dogs: boolean;
};

function speciesGroup(label: string): SpeciesGroup {
  if (/кабан|лос[ьяей]|олен|косул|копытн/i.test(label)) {
    return "hoofed";
  }
  if (/дич|ут(ок|ки|ку)|гус|вальдшнеп|тетерев|глухар|селез|ворон|рябчик|бекас/i.test(label)) {
    return "birds";
  }
  return "fur";
}

/** «A (…); B (…)» → части по «;» вне скобок. */
const count = (value: string, char: string) => value.split(char).length - 1;

/**
 * В распоряжениях скобки часто не закрыты («дупель (дупель – кроме …); полевую …»),
 * поэтому «;» склеивается обратно, только если следующий кусок закрывает скобку предыдущего.
 */
function splitParts(label: string): string[] {
  const normalized = label.replace(/([а-яё]+)\s*\(\1\s*[–—-]\s*([^);]+)\)?/gi, "$1 — $2");
  const parts: string[] = [];
  for (const piece of normalized.split(";")) {
    const last = parts.at(-1);
    if (last !== undefined && count(last, "(") > count(last, ")") && count(piece, ")") > count(piece, "(")) {
      parts[parts.length - 1] = `${last};${piece}`;
    } else {
      parts.push(piece);
    }
  }
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** «На болотно-луговую дичь (бекас, …)» → «Болотно-луговая» + «бекас, …». */
function describe(part: string, group: SpeciesGroup): { name: string; details: string } {
  const text = part.replace(/^на\s+/i, "").trim();
  const open = text.indexOf("(");
  let closesAtEnd = open >= 0;
  if (open >= 0) {
    let depth = 0;
    for (let index = open; index < text.length; index += 1) {
      if (text[index] === "(") depth += 1;
      if (text[index] === ")") depth -= 1;
      if (depth === 0) {
        closesAtEnd = text.slice(index + 1).trim() === "";
        break;
      }
    }
  }

  if (group !== "birds" || !closesAtEnd) {
    const plain = group === "birds" ? `на ${text}` : text;
    return { name: escapeHtml(plain), details: "" };
  }

  const name = text
    .slice(0, open)
    .trim()
    .replace(/([а-яё-]+?)ую(?![а-яё])/gi, "$1ая")
    .replace(/\s+дичь$/i, "");
  let details = text.slice(open + 1).trim();
  const opens = (details.match(/\(/g) ?? []).length;
  const closes = (details.match(/\)/g) ?? []).length;
  if (closes > opens) {
    details = details.replace(/\)\s*$/, "");
  }
  details = details.replace(/\s+-\s+/g, " — ").trim();
  return {
    name: escapeHtml(name ? name[0].toUpperCase() + name.slice(1) : text),
    details: escapeHtml(details),
  };
}

export function toHuntItems(entries: (HuntingSeasonEntry & { orderTopic?: string })[]): HuntItem[] {
  const items: HuntItem[] = [];
  const ordered = [...entries].sort(
    (a, b) => Number(/собак/i.test(a.orderTopic ?? "")) - Number(/собак/i.test(b.orderTopic ?? "")),
  );
  const seen = new Set<string>();
  for (const entry of ordered) {
    const dogs = /собак/i.test(entry.orderTopic ?? "");
    for (const part of splitParts(entry.label)) {
      const group = speciesGroup(part);
      const { name, details } = describe(part, group);
      const key = `${group}|${name.toLowerCase()}|${entry.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ group, name, details, start: entry.start, end: entry.end, dogs });
    }
  }
  return items;
}

function itemLine(item: HuntItem): string {
  const name = item.group === "birds" ? `<b>${item.name}</b>` : item.name;
  const head = `▫️ ${name}${item.dogs ? " · 🐕 с собакой" : ""}`;
  return item.details ? `${head}\n      <i>${item.details}</i>` : head;
}

/** Блоки по группам, внутри — по датам: «📅 до 30 ноября» и виды под ней. */
export function renderHuntItems(
  items: HuntItem[],
  mode: "until" | "from" | "period",
  todayKey: string,
): string[] {
  const lines: string[] = [];
  const thisYear = todayKey.slice(0, 4);
  const dateOf = (key: string) => shortDate(key, key.slice(0, 4) !== thisYear);
  const keyOf = (item: HuntItem) =>
    mode === "until" ? item.end : mode === "from" ? item.start : `${item.start}|${item.end}`;
  const labelOf = (key: string) => {
    if (mode === "until") return `до ${dateOf(key)}`;
    if (mode === "from") return `с ${dateOf(key)}`;
    const [start, end] = key.split("|");
    return `${dateOf(start)} – ${dateOf(end)}`;
  };

  for (const group of GROUPS) {
    const groupItems = items.filter((item) => item.group === group.id);
    if (groupItems.length === 0) continue;
    lines.push("", group.title);
    [...new Set(groupItems.map(keyOf))].sort().forEach((key, index) => {
      if (index > 0) lines.push("");
      lines.push(`📅 <u>${labelOf(key)}</u>`);
      for (const item of groupItems.filter((entry) => keyOf(entry) === key)) {
        lines.push(itemLine(item));
      }
    });
  }
  return lines;
}

export function buildHuntingSummaryHtml(overview: HuntingOverview): string {
  const open = toHuntItems(overview.now.filter((entry) => entry.status === "open"));
  const soon = toHuntItems(overview.now.filter((entry) => entry.status === "upcoming"));
  const lines = ["🦌 <b>Охота в Шатуре</b>", `<i>на ${shortDate(overview.today, true)}</i>`];

  if (open.length > 0) {
    lines.push("", "🟢 <b>ОТКРЫТО СЕЙЧАС</b>", ...renderHuntItems(open, "until", overview.today));
  }
  if (soon.length > 0) {
    lines.push("", "⏳ <b>СКОРО ОТКРОЕТСЯ</b>", ...renderHuntItems(soon, "from", overview.today));
  }
  if (open.length === 0 && soon.length === 0) {
    lines.push("", "По распоряжениям МООиР сейчас ничего не открыто.");
  }
  const awaited = awaitedOrders(overview);
  if (awaited.length > 0) {
    lines.push("", "📭 <b>НОВОГО РАСПОРЯЖЕНИЯ ЕЩЁ НЕТ</b>");
    for (const item of awaited) {
      lines.push(
        `• ${escapeHtml(item.order.topic || item.order.title)}`,
        `   на сезон ${item.season} МООиР ещё не опубликовал; в прошлом сезоне открывали с ${shortDate(item.lastStart)} — сроки у егеря`,
      );
    }
  }

  const contactLines = overview.contacts?.lines ?? [];
  const address = contactLines.find((line) => /ул\./i.test(line));
  const hours = contactLines.find((line) => /время работы/i.test(line));
  if (address || hours) {
    lines.push("", "📍 <b>Где взять путёвку</b>", "Шатурское ОРХ МООиР");
    if (address) lines.push(escapeHtml(address.replace(/^\d{6},\s*МО,\s*/i, "")));
    if (hours) lines.push(`🕘 ${escapeHtml(hours.replace(/^время работы:\s*/i, ""))}`);
  }
  lines.push(
    "",
    "ℹ️ Цены — /ceny · егеря — /kontakty · по видам — /help",
    `<a href="${MOOIR_ORDERS_URL}">Распоряжения МООиР</a>`,
  );
  return lines.join("\n");
}
