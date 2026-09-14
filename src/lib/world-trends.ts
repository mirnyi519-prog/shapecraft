import {
  moscowYmd,
  startOfMoscowWeekMonday,
} from "@/lib/timezone";

export type WorldPriceTier = "expensive" | "medium" | "cheap";

export type WorldTrendArticleView = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  priceTier: WorldPriceTier;
  priceLabel: string | null;
  sortOrder: number;
};

export type WorldTrendBatchView = {
  id: string;
  weekLabel: string;
  generatedAt: string;
  articles: WorldTrendArticleView[];
};

export const WORLD_TIER_ORDER: WorldPriceTier[] = ["expensive", "medium", "cheap"];

export const WORLD_TIER_LABELS: Record<WorldPriceTier, string> = {
  expensive: "Премиум",
  medium: "Средний сегмент",
  cheap: "Бюджетные",
};

export const WORLD_TIER_HINTS: Record<WorldPriceTier, string> = {
  expensive: "Топ-5 дорогих сувениров для 3D-печати",
  medium: "Топ-5 моделей среднего ценового сегмента",
  cheap: "Топ-5 доступных и популярных моделей",
};

export function isWorldPriceTier(value: string): value is WorldPriceTier {
  return value === "expensive" || value === "medium" || value === "cheap";
}

export function groupArticlesByTier(
  articles: WorldTrendArticleView[],
): Record<WorldPriceTier, WorldTrendArticleView[]> {
  return {
    expensive: articles
      .filter((item) => item.priceTier === "expensive")
      .sort((a, b) => a.sortOrder - b.sortOrder),
    medium: articles
      .filter((item) => item.priceTier === "medium")
      .sort((a, b) => a.sortOrder - b.sortOrder),
    cheap: articles
      .filter((item) => item.priceTier === "cheap")
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function getWeekLabel(date = new Date()): string {
  const monday = startOfMoscowWeekMonday(date);
  const { year, month, day } = moscowYmd(monday);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
