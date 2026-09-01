"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import {
  WORLD_TIER_HINTS,
  WORLD_TIER_LABELS,
  WORLD_TIER_ORDER,
  groupArticlesByTier,
  type WorldTrendArticleView,
  type WorldTrendBatchView,
} from "@/lib/world-trends";

function ArticleCard({ article }: { article: WorldTrendArticleView }) {
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
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--muted)]">
            Фото модели
          </div>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">{article.name}</h3>
          {article.priceLabel ? (
            <Badge tone="warning">{article.priceLabel}</Badge>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed text-[var(--text)]">
          {article.description}
        </p>
        {article.sourceUrl ? (
          <Link
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Источник →
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

export function WorldTrendsView({
  batch,
}: {
  batch: WorldTrendBatchView | null;
}) {
  if (!batch || batch.articles.length === 0) {
    return (
      <Card>
        <p className="text-[var(--muted)]">
          Подборка пока не готова. Откройте эту страницу — синхронизация с GitHub
          запустится автоматически.
        </p>
      </Card>
    );
  }

  const grouped = groupArticlesByTier(batch.articles);
  const generatedAt = new Date(batch.generatedAt).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--muted)]">
        Неделя от {generatedAt} · {batch.articles.length} моделей
      </p>

      {WORLD_TIER_ORDER.map((tier) => {
        const articles = grouped[tier];
        if (articles.length === 0) {
          return null;
        }

        return (
          <section key={tier} className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">{WORLD_TIER_LABELS[tier]}</h2>
              <p className="text-sm text-[var(--muted)]">{WORLD_TIER_HINTS[tier]}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function WorldTrendsAdmin({
  lastGenerated,
  weekLabel,
  articleCount,
  imagesLoaded,
  needsSync,
  currentWeek,
}: {
  lastGenerated: string | null;
  weekLabel: string | null;
  articleCount: number;
  imagesLoaded: number;
  needsSync: boolean;
  currentWeek: string;
}) {
  const router = useRouter();
  const autoSyncStarted = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSync(isAuto = false) {
    setLoading(true);
    setError("");
    setMessage(isAuto ? "Автосинхронизация..." : "");

    const response = await fetch("/api/world/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });

    const data = (await response.json()) as {
      error?: string;
      articleCount?: number;
      weekLabel?: string;
      imagesLoaded?: number;
    };

    if (!response.ok) {
      setError(data.error ?? "Ошибка синхронизации");
      setLoading(false);
      return;
    }

    setMessage(
      `Подборка ${data.weekLabel} обновлена: ${data.articleCount ?? 0} статей, фото: ${data.imagesLoaded ?? 0}`,
    );
    setLoading(false);
    router.refresh();
  }

  useEffect(() => {
    if (!needsSync || autoSyncStarted.current) {
      return;
    }

    autoSyncStarted.current = true;
    void handleSync(true);
  }, [needsSync]);

  return (
    <Card title="Автоматизация подборки">
      <p className="mb-3 text-sm text-[var(--muted)]">
        Подборка подтягивается с GitHub, фото — с MakerWorld. В Cursor достаточно
        написать <strong>«Обнови подборку В мире»</strong>: агент обновит JSON,
        запушит в репозиторий и синхронизирует сайт.
      </p>

      <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted)]">Текущая неделя</dt>
          <dd className="font-medium">{currentWeek}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Неделя в базе</dt>
          <dd className="font-medium">{weekLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Статей / фото</dt>
          <dd className="font-medium">
            {articleCount} / {imagesLoaded}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Последнее обновление</dt>
          <dd className="font-medium">
            {lastGenerated
              ? new Date(lastGenerated).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </dd>
        </div>
      </dl>

      {needsSync ? (
        <p className="mb-3 text-sm text-amber-700">
          Подборка устарела или пустая — идёт автоматическая синхронизация с GitHub.
        </p>
      ) : (
        <p className="mb-3 text-sm text-green-700">Подборка актуальна для этой недели.</p>
      )}

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-green-700">{message}</p> : null}

      <Button
        type="button"
        disabled={loading}
        onClick={() => void handleSync(false)}
      >
        {loading ? "Синхронизация..." : "Обновить подборку сейчас"}
      </Button>
    </Card>
  );
}
