import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  HUNTING_STALE_HOURS,
  MOOIR_ORDERS_URL,
  MOOIR_ORIGIN,
  MOOIR_PRICES_URL,
  MOOIR_UNITS_URL,
  SHATURA_MAP_URL,
  findRussianDate,
  htmlToText,
  isOtherFarmPrice,
  parseOrderRules,
  parseOrderTopic,
  parsePriceNotes,
  parsePriceRows,
  parseSeasonEntries,
  ymdKey,
  type HuntingContacts,
  type HuntingKind,
  type HuntingLink,
  type HuntingNowItem,
  type HuntingOrder,
  type HuntingOverview,
  type HuntingPriceList,
  type HuntingPriceRow,
} from "@/lib/hunting-shared";
import { getPublicSiteUrl, sendTelegramMessage } from "@/lib/telegram";
import { moscowYmd } from "@/lib/timezone";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const LIST_LIMIT = 8;
const NEW_BADGE_DAYS = 14;
const ORDERS_SHOWN = 8;

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "ru-RU,ru" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function listDocUrls(html: string, section: "prikras" | "predus"): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(new RegExp(`/official/${section}/(\\d+)/`, "g"))) {
    ids.add(match[1]);
  }
  return [...ids].slice(0, LIST_LIMIT).map((id) => `${MOOIR_ORIGIN}/official/${section}/${id}/`);
}

function articleParts(html: string): { title: string; bodyHtml: string } {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const title = h1 ? htmlToText(h1[1]).replace(/\s+/g, " ") : "";
  const from = h1 ? h1.index + h1[0].length : 0;
  const to = html.indexOf("Ко всем материалам", from);
  return { title, bodyHtml: html.slice(from, to > from ? to : undefined) };
}

/** Без шапки карточки (рубрика, дата, счётчик просмотров) — иначе хэш меняется на каждом проходе. */
function articleText(bodyHtml: string): string {
  const lines = htmlToText(bodyHtml)
    .split("\n")
    .filter((line) => !/^\d[\d\s]*просмотр/i.test(line) && line !== "-->");
  const firstReal = lines.findIndex((line) => line.length >= 40);
  return lines.slice(Math.max(0, firstReal)).join("\n");
}

type Collected = {
  url: string;
  kind: HuntingKind;
  title: string;
  docDate: Date | null;
  text: string;
  dataJson: string;
};

function toDate(key: string | null): Date | null {
  return key ? new Date(`${key}T00:00:00+03:00`) : null;
}

async function collectOrders(errors: string[]): Promise<Collected[]> {
  const list = await fetchHtml(MOOIR_ORDERS_URL);
  const result: Collected[] = [];
  for (const url of listDocUrls(list, "prikras")) {
    try {
      const { title, bodyHtml } = articleParts(await fetchHtml(url));
      const text = articleText(bodyHtml);
      if (!/охот/i.test(text)) {
        continue;
      }
      result.push({
        url,
        kind: "order",
        title,
        docDate: toDate(findRussianDate(title) ?? findRussianDate(text)),
        text,
        dataJson: "",
      });
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : "ошибка"}`);
    }
  }
  return result;
}

async function collectPrices(errors: string[]): Promise<Collected[]> {
  const list = await fetchHtml(MOOIR_PRICES_URL);
  const result: Collected[] = [];
  for (const url of listDocUrls(list, "predus")) {
    try {
      const { title, bodyHtml } = articleParts(await fetchHtml(url));
      if (!/прейскурант/i.test(title) || isOtherFarmPrice(title)) {
        continue;
      }
      const rows = parsePriceRows(bodyHtml);
      if (rows.length === 0) {
        continue;
      }
      const text = articleText(bodyHtml);
      result.push({
        url,
        kind: "price",
        title,
        docDate: toDate(findRussianDate(text) ?? findRussianDate(title)),
        text,
        dataJson: JSON.stringify(rows),
      });
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : "ошибка"}`);
    }
  }
  return result;
}

async function collectContacts(): Promise<Collected | null> {
  const html = await fetchHtml(MOOIR_UNITS_URL);
  const at = html.search(/Шатурское\s+охотничье/i);
  if (at < 0) {
    return null;
  }
  const anchor = html.lastIndexOf('id="orh-', at);
  const start = anchor >= 0 && at - anchor < 2000 ? anchor : Math.max(0, at - 400);
  const endMark = html.indexOf("КВИТАНЦИЯ", at);
  const end = endMark > at ? html.indexOf("</a>", endMark) + 4 : at + 4000;
  const block = html.slice(start, end);

  const links: HuntingLink[] = [{ label: "Карта угодий", url: SHATURA_MAP_URL }];
  for (const match of block.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = htmlToText(match[2]).replace(/[►\s]+$/u, "").trim();
    if (!/квитанц/i.test(label)) {
      continue;
    }
    const href = match[1].startsWith("http") ? match[1] : `${MOOIR_ORIGIN}${match[1]}`;
    links.push({ label: "Квитанция для оплаты", url: href });
  }

  const text = htmlToText(block.replace(/^[^>]*>/, ""))
    .split("\n")
    .filter((line) => !/посмотреть на карте|квитанция/i.test(line))
    .join("\n");

  return {
    url: `${MOOIR_UNITS_URL}#orh-33`,
    kind: "contacts",
    title: "Шатурское охотничье-рыболовное хозяйство",
    docDate: null,
    text,
    dataJson: JSON.stringify(links),
  };
}

export type HuntingCollectResult = {
  ok: boolean;
  checked: number;
  added: string[];
  changed: string[];
  errors: string[];
};

let running: Promise<HuntingCollectResult> | null = null;

/** Обходит mooir.ru и сохраняет изменения. Параллельные вызовы ждут один и тот же проход. */
export function collectHunting(): Promise<HuntingCollectResult> {
  running ??= runCollect().finally(() => {
    running = null;
  });
  return running;
}

async function runCollect(): Promise<HuntingCollectResult> {
  const errors: string[] = [];
  const collected: Collected[] = [];

  const steps: [string, () => Promise<Collected[]>][] = [
    ["распоряжения", () => collectOrders(errors)],
    ["прейскурант", () => collectPrices(errors)],
    ["контакты", async () => {
      const contacts = await collectContacts();
      return contacts ? [contacts] : [];
    }],
  ];
  for (const [label, step] of steps) {
    try {
      collected.push(...(await step()));
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : "ошибка"}`);
    }
  }

  const priceSources = await prisma.huntingSource.findMany({
    where: { kind: "price" },
    select: { id: true, title: true },
  });
  const foreignPrices = priceSources.filter((source) => isOtherFarmPrice(source.title));
  if (foreignPrices.length > 0) {
    await prisma.huntingSource.deleteMany({ where: { id: { in: foreignPrices.map((source) => source.id) } } });
  }

  const hadData = (await prisma.huntingSource.count()) > 0;
  const now = new Date();
  const added: string[] = [];
  const changed: string[] = [];

  for (const item of collected) {
    const hash = createHash("sha1").update(`${item.title}\n${item.text}\n${item.dataJson}`).digest("hex");
    const existing = await prisma.huntingSource.findUnique({ where: { url: item.url } });
    if (!existing) {
      await prisma.huntingSource.create({
        data: { ...item, hash, firstSeenAt: now, changedAt: now, fetchedAt: now },
      });
      added.push(item.title);
      if (hadData && item.kind !== "contacts") {
        await notifyNew(item);
      }
    } else if (existing.hash !== hash) {
      await prisma.huntingSource.update({
        where: { id: existing.id },
        data: { ...item, hash, changedAt: now, fetchedAt: now },
      });
      changed.push(item.title);
    } else {
      await prisma.huntingSource.update({ where: { id: existing.id }, data: { fetchedAt: now } });
    }
  }

  return { ok: collected.length > 0, checked: collected.length, added, changed, errors };
}

async function notifyNew(item: Collected) {
  const header = item.kind === "order" ? "🦆 МООиР: новое распоряжение" : "🦆 МООиР: новый прейскурант";
  const topic = item.kind === "order" ? parseOrderTopic(item.text) : "";
  await sendTelegramMessage(
    [header, item.title, topic || null, item.url, `Сводка: ${getPublicSiteUrl()}/other/hunting`]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function getHuntingLastFetch(): Promise<Date | null> {
  const latest = await prisma.huntingSource.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });
  return latest?.fetchedAt ?? null;
}

export function isHuntingStale(lastFetch: Date | null): boolean {
  return !lastFetch || Date.now() - lastFetch.getTime() > HUNTING_STALE_HOURS * 3_600_000;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function getHuntingOverview(): Promise<HuntingOverview> {
  const sources = await prisma.huntingSource.findMany({
    orderBy: [{ docDate: "desc" }, { firstSeenAt: "desc" }],
  });
  const ymd = moscowYmd();
  const today = ymdKey(ymd.year, ymd.month, ymd.day);
  const newSince = Date.now() - NEW_BADGE_DAYS * 86_400_000;

  const orders: HuntingOrder[] = sources
    .filter((source) => source.kind === "order")
    .slice(0, ORDERS_SHOWN)
    .map((source) => {
      const year = source.docDate ? moscowYmd(source.docDate).year : ymd.year;
      return {
        id: source.id,
        url: source.url,
        title: source.title,
        topic: parseOrderTopic(source.text),
        docDate: source.docDate?.toISOString() ?? null,
        isNew:
          source.firstSeenAt.getTime() > newSince &&
          (source.docDate ?? source.firstSeenAt).getTime() > newSince,
        entries: parseSeasonEntries(source.text, year, today),
        rules: parseOrderRules(source.text),
        text: source.text,
      };
    });

  const seen = new Set<string>();
  const now: HuntingNowItem[] = orders
    .flatMap((order) =>
      order.entries.map((entry) => ({
        ...entry,
        orderTitle: order.title,
        orderTopic: order.topic,
        orderUrl: order.url,
      })),
    )
    .filter((entry) => {
      if (entry.scope === "excluded" || entry.status === "closed") {
        return false;
      }
      if (entry.status === "upcoming" && entry.days > 45) {
        return false;
      }
      const key = `${entry.label}|${entry.start}|${entry.end}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      a.status !== b.status
        ? a.status === "open"
          ? -1
          : 1
        : a.status === "open"
          ? a.end.localeCompare(b.end)
          : a.start.localeCompare(b.start),
    );

  const priceSource = sources.find(
    (source) => source.kind === "price" && !isOtherFarmPrice(source.title),
  );
  const prices: HuntingPriceList | null = priceSource
    ? {
        url: priceSource.url,
        title: priceSource.title,
        docDate: priceSource.docDate?.toISOString() ?? null,
        rows: parseJson<HuntingPriceRow[]>(priceSource.dataJson, []),
        notes: parsePriceNotes(priceSource.text),
      }
    : null;

  const contactsSource = sources.find((source) => source.kind === "contacts");
  const contacts: HuntingContacts | null = contactsSource
    ? {
        url: contactsSource.url,
        lines: contactsSource.text.split("\n").filter(Boolean),
        links: parseJson<HuntingLink[]>(contactsSource.dataJson, []),
      }
    : null;

  const fetchedAt = sources.reduce<Date | null>(
    (latest, source) => (!latest || source.fetchedAt > latest ? source.fetchedAt : latest),
    null,
  );

  return { fetchedAt: fetchedAt?.toISOString() ?? null, today, now, orders, prices, contacts };
}
