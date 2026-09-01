import Image from "next/image";
import { Badge, Card } from "@/components/ui";
import type { WorldTrendArticleView } from "@/lib/world-trends";

function WorldTrendCard({ article }: { article: WorldTrendArticleView }) {
  return (
    <Card className="h-full w-[17rem] shrink-0 overflow-hidden p-0 sm:w-[19rem]">
      <div className="relative aspect-[4/3] bg-[var(--brand-soft)]">
        {article.imageUrl ? (
          <Image
            src={article.imageUrl}
            alt={article.name}
            fill
            className="object-cover"
            sizes="19rem"
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

  return (
    <section className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Сейчас в тренде у 3D-мейкеров</h2>
          <Badge tone="neutral">мир</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Подборка идей, которые сейчас популярны у 3D-печатников по всему миру
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {articles.map((article) => (
          <WorldTrendCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
