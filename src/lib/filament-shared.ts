/** Общее для страницы и API «Филамент». Без Node-модулей. */

export type FilamentMarketplace = "ym" | "wb" | "ozon";

export const FILAMENT_MARKETPLACES: FilamentMarketplace[] = ["ym", "wb", "ozon"];

export const MARKETPLACE_LABELS: Record<FilamentMarketplace, string> = {
  ym: "Яндекс Маркет",
  wb: "Wildberries",
  ozon: "Ozon",
};

/** Линейки Bambu Lab, которые ищут чаще всего. */
export const FILAMENT_PRESETS = [
  "PLA Basic",
  "PLA Matte",
  "PLA Silk+",
  "PLA Translucent",
  "PLA-CF",
  "PETG HF",
  "PETG Translucent",
  "ABS",
  "ASA",
  "TPU 95A HF",
  "Support for PLA",
] as const;

/** Цены старше этого не участвуют в «лучшей цене». */
export const FILAMENT_FRESH_DAYS = 7;

export function isFilamentMarketplace(value: unknown): value is FilamentMarketplace {
  return value === "ym" || value === "wb" || value === "ozon";
}

/** «pla matte  черный» → «Bambu Lab PLA Matte черный». */
export function normalizeFilamentQuery(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!text) {
    return "";
  }
  const withoutBrand = text.replace(/^\s*bambu\s*lab\s*/i, "").replace(/^\s*bambu\s*/i, "");
  const lower = withoutBrand.toLowerCase();
  const preset = [...FILAMENT_PRESETS]
    .sort((a, b) => b.length - a.length)
    .find((name) => lower === name.toLowerCase() || lower.startsWith(`${name.toLowerCase()} `));
  // Одинаковый запрос в разном регистре — одна история цен.
  const tail = preset
    ? `${preset}${withoutBrand.slice(preset.length).toLowerCase()}`
    : lower
        .split(" ")
        .map((word) => (/^[a-z0-9+-]+$/.test(word) && word.length <= 4 ? word.toUpperCase() : word))
        .join(" ");
  return `Bambu Lab ${tail}`.trim();
}

/** Поиск на площадке, отсортированный по возрастанию цены. */
export function marketplaceSearchUrl(marketplace: FilamentMarketplace, query: string): string {
  const q = encodeURIComponent(query);
  switch (marketplace) {
    case "ym":
      return `https://market.yandex.ru/search?text=${q}&how=aprice`;
    case "wb":
      return `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}&sort=priceup`;
    case "ozon":
      return `https://www.ozon.ru/search/?text=${q}&sorting=price`;
  }
}

export type FilamentOffer = {
  title: string;
  price: number;
  url: string;
  imageUrl: string;
};

export type FilamentPriceRow = {
  id: string;
  marketplace: FilamentMarketplace;
  price: number;
  title: string;
  url: string;
  source: "auto" | "manual";
  createdAt: string;
};

export type FilamentSummary = {
  query: string;
  links: Record<FilamentMarketplace, string>;
  /** Последняя свежая цена по каждой площадке. */
  latest: Partial<Record<FilamentMarketplace, FilamentPriceRow>>;
  best: FilamentPriceRow | null;
  history: FilamentPriceRow[];
};

export type YandexSearchResult =
  | { status: "ok"; offers: FilamentOffer[]; loose: boolean }
  | { status: "blocked" | "error"; offers: []; message: string };

export type FilamentRecentQuery = {
  query: string;
  lastAt: string;
  bestPrice: number | null;
  bestMarketplace: FilamentMarketplace | null;
};
