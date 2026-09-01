import type { WorldTrendArticleView, WorldTrendBatchView } from "@/lib/world-trends";
import {
  WORLD_TIER_ORDER,
  groupArticlesByTier,
  isWorldPriceTier,
} from "@/lib/world-trends";
import { getLatestWorldTrendBatch } from "@/lib/world-trends-bot";

export function mapWorldTrendBatch(
  batch: NonNullable<Awaited<ReturnType<typeof getLatestWorldTrendBatch>>>,
): WorldTrendBatchView {
  return {
    id: batch.id,
    weekLabel: batch.weekLabel,
    generatedAt: batch.generatedAt.toISOString(),
    articles: batch.articles.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      sourceUrl: item.sourceUrl,
      priceTier: isWorldPriceTier(item.priceTier) ? item.priceTier : "medium",
      priceLabel: item.priceLabel,
      sortOrder: item.sortOrder,
    })),
  };
}

export async function getLatestWorldTrendBatchView(): Promise<WorldTrendBatchView | null> {
  const latest = await getLatestWorldTrendBatch();
  return latest ? mapWorldTrendBatch(latest) : null;
}

export function pickWorldTrendHighlights(
  articles: WorldTrendArticleView[],
  limit = 6,
): WorldTrendArticleView[] {
  const grouped = groupArticlesByTier(articles);
  const perTier = Math.max(1, Math.ceil(limit / WORLD_TIER_ORDER.length));
  const picked: WorldTrendArticleView[] = [];

  for (const tier of WORLD_TIER_ORDER) {
    picked.push(...grouped[tier].slice(0, perTier));
  }

  return picked.slice(0, limit);
}
