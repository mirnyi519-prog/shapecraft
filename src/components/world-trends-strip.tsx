import Image from "next/image";
import { Badge, Card } from "@/components/ui";
import {
  WORLD_TIER_HINTS,
  WORLD_TIER_LABELS,
  WORLD_TIER_ORDER,
  groupArticlesByTier,
  type WorldTrendArticleView,
} from "@/lib/world-trends";

function WorldTrendCard({ article }: { article: WorldTrendArticleView }) {
  return (
    <Card className="h-full overflow-hidden p-0">
      <div className="relative aspect-[4/3] bg-[var(--brand-soft)]">
        {article.imageUrl ? (
          <Image
            src={article.imageUrl}
            alt={article.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
            Фото модели
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">{article.name}</h3>
          {article.priceLabel ? (
            <Badge tone="warning">{article.priceLabel}</Badge>
          ) : null}
        </div>
        <p className="line-clamp-3 text-sm text-[var(--muted)]">
          {article.description}
        </p>
      </div>
    </Card>
  );
}

export function WorldTrendsStrip({
  articles,
}: {
  articles: WorldTrendArticleView[];
}) {
  if (articles.length === 0) {
    return null;
  }

  const grouped = groupArticlesByTier(articles);

  return (
    <section className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Сейчас в тренде у 3D-мейкеров</h2>
          <Badge tone="neutral">мир</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Подборка идей, которые сейчас популярны у 3D-печатников по всему миру ·{" "}
          {articles.length} моделей
        </p>
      </div>

      {WORLD_TIER_ORDER.map((tier) => {
        const tierArticles = grouped[tier];
        if (tierArticles.length === 0) {
          return null;
        }

        return (
          <div key={tier} className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">{WORLD_TIER_LABELS[tier]}</h3>
              <p className="text-sm text-[var(--muted)]">{WORLD_TIER_HINTS[tier]}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tierArticles.map((article) => (
                <WorldTrendCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
