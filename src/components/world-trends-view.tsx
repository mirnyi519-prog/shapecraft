"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
          Подборка пока не готова. Админ может запустить еженедельный бот вручную.
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
}: {
  lastGenerated: string | null;
}) {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleImport() {
    setLoading(true);
    setError("");
    setMessage("");

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("Некорректный JSON");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/world/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles: parsed, force }),
    });

    const data = (await response.json()) as {
      error?: string;
      articleCount?: number;
      weekLabel?: string;
    };

    if (!response.ok) {
      setError(data.error ?? "Ошибка импорта");
      setLoading(false);
      return;
    }

    setMessage(
      `Подборка ${data.weekLabel} импортирована: ${data.articleCount ?? 0} статей`,
    );
    setLoading(false);
    router.refresh();
  }

  return (
    <Card title="Импорт от агента Cursor">
      <p className="mb-3 text-sm text-[var(--muted)]">
        Платный OpenAI больше не нужен. Попросите в Cursor:{" "}
        <strong>«Обнови подборку В мире»</strong> — агент найдёт тренды,
        соберёт JSON и импортирует. Или вставьте JSON ниже вручную.
      </p>
      {lastGenerated ? (
        <p className="mb-3 text-sm text-[var(--muted)]">
          Последнее обновление:{" "}
          {new Date(lastGenerated).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      ) : null}
      <label className="mb-3 block space-y-2">
        <span className="text-sm font-medium">JSON подборки (15 статей)</span>
        <textarea
          value={json}
          onChange={(event) => setJson(event.target.value)}
          placeholder='{"articles":[{"name":"...","description":"...","priceTier":"expensive","priceLabel":"3000 ₽","sourceUrl":"https://..."}]}'
          className="min-h-48 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 font-mono text-xs outline-none ring-[var(--brand)] focus:ring-2"
        />
      </label>
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={force}
          onChange={(event) => setForce(event.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        Перезаписать подборку текущей недели
      </label>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-green-700">{message}</p> : null}
      <Button type="button" disabled={loading || !json.trim()} onClick={() => void handleImport()}>
        {loading ? "Импорт..." : "Импортировать подборку"}
      </Button>
    </Card>
  );
}
