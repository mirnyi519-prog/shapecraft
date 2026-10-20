import { prisma } from "@/lib/db";
import {
  FILAMENT_FRESH_DAYS,
  FILAMENT_MARKETPLACES,
  isFilamentMarketplace,
  marketplaceSearchUrl,
  type FilamentMarketplace,
  type FilamentOffer,
  type FilamentPriceRow,
  type FilamentRecentQuery,
  type FilamentSummary,
  type YandexSearchResult,
} from "@/lib/filament-shared";

const YM_TIMEOUT_MS = 15_000;
const YM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9",
  Accept: "text/html,application/xhtml+xml",
};

/** Слова запроса, которые должны быть в названии товара. */
function queryTokens(query: string): string[] {
  return normalizeForMatch(query)
    .split(" ")
    .filter((word) => word && word !== "bambu" && word !== "lab");
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9+]+/g, " ")
    .trim();
}

/** Пробники «10 метров» — не катушка, в сравнение не берём. */
function isSample(title: string): boolean {
  const lower = title.toLowerCase();
  return /\d+\s*(м|метр)/.test(lower) && !/(кг|kg|1000\s*г)/.test(lower);
}

type LdItem = {
  item?: {
    name?: string;
    url?: string;
    image?: string;
    offers?: { price?: number | string; lowPrice?: number | string };
  };
};

function parseYandexOffers(html: string): FilamentOffer[] {
  const offers: FilamentOffer[] = [];
  const scripts = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  );
  for (const match of scripts) {
    let data: { "@type"?: string; itemListElement?: LdItem[] };
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (data["@type"] !== "ItemList" || !Array.isArray(data.itemListElement)) {
      continue;
    }
    for (const entry of data.itemListElement) {
      const item = entry.item;
      const price = Math.round(Number(item?.offers?.price ?? item?.offers?.lowPrice));
      if (!item?.name || !Number.isFinite(price) || price <= 0) {
        continue;
      }
      offers.push({
        title: item.name.trim(),
        price,
        url: item.url ?? "",
        imageUrl: item.image ?? "",
      });
    }
  }
  return offers;
}

/** Поиск на Яндекс Маркете по возрастанию цены. Берём разметку schema.org со страницы. */
export async function searchYandexMarket(query: string): Promise<YandexSearchResult> {
  let html: string;
  try {
    const response = await fetch(marketplaceSearchUrl("ym", query), {
      headers: YM_HEADERS,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(YM_TIMEOUT_MS),
    });
    html = await response.text();
    if (response.url.includes("showcaptcha") || response.status === 403) {
      return {
        status: "blocked",
        offers: [],
        message: "Маркет попросил капчу — откройте поиск по ссылке и запишите цену вручную.",
      };
    }
    if (!response.ok) {
      return { status: "error", offers: [], message: `Маркет ответил ${response.status}` };
    }
  } catch {
    return { status: "error", offers: [], message: "Маркет не ответил вовремя" };
  }

  const all = parseYandexOffers(html);
  if (all.length === 0) {
    const captcha = /captcha/i.test(html);
    return {
      status: captcha ? "blocked" : "error",
      offers: [],
      message: captcha
        ? "Маркет попросил капчу — откройте поиск по ссылке и запишите цену вручную."
        : "На странице Маркета не нашлось товаров",
    };
  }

  const tokens = queryTokens(query);
  const bambu = all.filter(
    (offer) => /bambu/i.test(offer.title) && !isSample(offer.title),
  );
  const exact = bambu.filter((offer) => {
    const title = normalizeForMatch(offer.title);
    return tokens.every((token) => title.includes(token));
  });
  const offers = (exact.length > 0 ? exact : bambu).sort((a, b) => a.price - b.price);
  return { status: "ok", offers: offers.slice(0, 6), loose: exact.length === 0 };
}

function toRow(row: {
  id: string;
  marketplace: string;
  price: number;
  title: string;
  url: string;
  source: string;
  createdAt: Date;
}): FilamentPriceRow {
  return {
    id: row.id,
    marketplace: isFilamentMarketplace(row.marketplace) ? row.marketplace : "ym",
    price: row.price,
    title: row.title,
    url: row.url,
    source: row.source === "manual" ? "manual" : "auto",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordFilamentPrice(input: {
  query: string;
  marketplace: FilamentMarketplace;
  price: number;
  title?: string;
  url?: string;
  imageUrl?: string;
  source: "auto" | "manual";
}) {
  await prisma.filamentPrice.create({
    data: {
      query: input.query,
      marketplace: input.marketplace,
      price: input.price,
      title: (input.title ?? "").slice(0, 300),
      url: (input.url ?? "").slice(0, 1000),
      imageUrl: (input.imageUrl ?? "").slice(0, 1000),
      source: input.source,
    },
  });
}

export async function getFilamentSummary(query: string): Promise<FilamentSummary> {
  const rows = await prisma.filamentPrice.findMany({
    where: { query },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const history = rows.map(toRow);
  const freshSince = Date.now() - FILAMENT_FRESH_DAYS * 24 * 60 * 60 * 1000;

  const latest: FilamentSummary["latest"] = {};
  for (const row of history) {
    if (new Date(row.createdAt).getTime() < freshSince) {
      continue;
    }
    if (!latest[row.marketplace]) {
      latest[row.marketplace] = row;
    }
  }
  const best =
    Object.values(latest).reduce<FilamentPriceRow | null>(
      (min, row) => (row && (!min || row.price < min.price) ? row : min),
      null,
    ) ?? null;

  const links = Object.fromEntries(
    FILAMENT_MARKETPLACES.map((marketplace) => [
      marketplace,
      marketplaceSearchUrl(marketplace, query),
    ]),
  ) as Record<FilamentMarketplace, string>;

  return { query, links, latest, best, history: history.slice(0, 20) };
}

export async function getRecentFilamentQueries(limit = 8): Promise<FilamentRecentQuery[]> {
  const since = new Date(Date.now() - FILAMENT_FRESH_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.filamentPrice.findMany({
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { query: true, marketplace: true, price: true, createdAt: true },
  });

  const byQuery = new Map<string, FilamentRecentQuery>();
  // Как в сводке: считается только последняя цена каждой площадки.
  const seen = new Set<string>();
  for (const row of rows) {
    let entry = byQuery.get(row.query);
    if (!entry) {
      if (byQuery.size >= limit) {
        continue;
      }
      entry = {
        query: row.query,
        lastAt: row.createdAt.toISOString(),
        bestPrice: null,
        bestMarketplace: null,
      };
      byQuery.set(row.query, entry);
    }
    const key = `${row.query}\u0000${row.marketplace}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (row.createdAt >= since && (entry.bestPrice === null || row.price < entry.bestPrice)) {
      entry.bestPrice = row.price;
      entry.bestMarketplace = isFilamentMarketplace(row.marketplace) ? row.marketplace : null;
    }
  }
  return [...byQuery.values()];
}
