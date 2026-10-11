"use client";

import { useEffect, useState } from "react";
import { ModalCloseButton } from "@/components/modal-close-button";
import { PrintOrderModal } from "@/components/print-order-modal";
import { Badge, Button } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { cardMediaUrl } from "@/lib/card-media-url";
import {
  WORLD_TIER_HINTS,
  WORLD_TIER_LABELS,
  WORLD_TIER_ORDER,
  groupArticlesByTier,
  type WorldTrendArticleView,
} from "@/lib/world-trends";

function WorldTrendCard({
  article,
  onOpen,
  onOrder,
}: {
  article: WorldTrendArticleView;
  onOpen: (article: WorldTrendArticleView) => void;
  onOrder: (article: WorldTrendArticleView) => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition hover:border-[var(--brand)]">
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="flex flex-1 flex-col p-0 text-left"
      >
        <span className="relative block aspect-[4/3] bg-[var(--brand-soft)]">
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardMediaUrl(article.imageUrl) ?? article.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
              Фото модели
            </span>
          )}
          {article.collection === "new" ? (
            <span className="absolute left-3 top-3 z-10">
              <Badge tone="warning">новое</Badge>
            </span>
          ) : null}
        </span>
        <span className="flex flex-1 flex-col gap-2 p-4">
          <span className="text-base font-semibold leading-snug">{article.name}</span>
          {article.priceLabel ? (
            <span className="mt-auto">
              <Badge tone="warning">{article.priceLabel}</Badge>
            </span>
          ) : null}
        </span>
      </button>
      <div className="px-4 pb-4">
        <Button
          type="button"
          className="min-h-11 w-full"
          onClick={() => onOrder(article)}
        >
          Заказать печать
        </Button>
      </div>
    </article>
  );
}

function TierGrid({
  articles,
  onOpen,
  onOrder,
}: {
  articles: WorldTrendArticleView[];
  onOpen: (article: WorldTrendArticleView) => void;
  onOrder: (article: WorldTrendArticleView) => void;
}) {
  const grouped = groupArticlesByTier(articles);

  return (
    <div className="space-y-6">
      {WORLD_TIER_ORDER.map((tier) => {
        const tierArticles = grouped[tier];
        if (tierArticles.length === 0) {
          return null;
        }

        return (
          <div key={tier} className="space-y-3">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-[var(--text)]">
                {WORLD_TIER_LABELS[tier]}
              </h3>
              <p className="text-sm leading-snug text-[#3d3d3e]">
                {WORLD_TIER_HINTS[tier]}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tierArticles.map((article) => (
                <WorldTrendCard
                  key={article.id}
                  article={article}
                  onOpen={onOpen}
                  onOrder={onOrder}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WorldTrendsStrip({
  articles,
  expanded = false,
  title = "Сейчас в тренде у 3D-мейкеров",
}: {
  articles: WorldTrendArticleView[];
  expanded?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(expanded);
  const [selected, setSelected] = useState<WorldTrendArticleView | null>(null);
  const [orderArticle, setOrderArticle] = useState<WorldTrendArticleView | null>(
    null,
  );
  const visible = expanded || open;
  useScrollLock(Boolean(selected) || Boolean(orderArticle));

  function openOrder(article: WorldTrendArticleView) {
    setOrderArticle(article);
  }

  useEffect(() => {
    if (!selected) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !orderArticle) {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, orderArticle]);

  if (articles.length === 0) {
    return null;
  }

  const fresh = articles.filter((article) => article.collection === "new");
  const popular = articles.filter((article) => article.collection !== "new");

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`font-bold tracking-tight text-[var(--text)] ${
                expanded ? "text-2xl sm:text-3xl" : "text-lg"
              }`}
            >
              {title}
            </h2>
            <Badge tone="neutral">мир</Badge>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-[#3d3d3e] sm:text-base">
            Новинки и популярные идеи · {articles.length} моделей
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3.5 py-1.5 text-sm font-semibold text-[var(--brand-dark)]">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
            Вы можете заказать
          </p>
        </div>
        {expanded ? null : (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 shrink-0"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Свернуть" : "Показать идеи"}
          </Button>
        )}
      </div>

      {visible ? (
        <div className="space-y-8">
          {fresh.length > 0 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Новинки</h3>
                <p className="text-sm leading-snug text-[#3d3d3e]">
                  Свежие модели, которых ещё не было в подборке · {fresh.length}
                </p>
              </div>
              <TierGrid
                articles={fresh}
                onOpen={setSelected}
                onOrder={openOrder}
              />
            </div>
          ) : null}
          <div className="space-y-4">
            {fresh.length > 0 ? (
              <div>
                <h3 className="text-xl font-bold tracking-tight">Популярные</h3>
                <p className="text-sm leading-snug text-[#3d3d3e]">
                  Проверенные идеи, которые уже печатают · {popular.length}
                </p>
              </div>
            ) : null}
            <TierGrid
              articles={popular}
              onOpen={setSelected}
              onOrder={openOrder}
            />
          </div>
        </div>
      ) : null}

      {selected ? (
        <div
          className="safe-overlay fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => {
            if (!orderArticle) {
              setSelected(null);
            }
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="world-model-title"
            className="flex max-h-[min(96vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl sm:border sm:border-[var(--border)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative aspect-[4/3] shrink-0 bg-[var(--brand-soft)]">
              {selected.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardMediaUrl(selected.imageUrl) ?? selected.imageUrl}
                  alt={selected.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute right-3 top-3 z-20">
                <ModalCloseButton onClick={() => setSelected(null)} />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <h2 id="world-model-title" className="text-2xl font-bold">
                {selected.name}
              </h2>
              {selected.priceLabel ? (
                <p className="text-lg font-semibold text-[var(--brand)]">
                  примерно {selected.priceLabel}
                </p>
              ) : (
                <p className="text-sm text-[var(--muted)]">Цену оценим по телефону</p>
              )}
              <p className="text-sm leading-relaxed text-[var(--text)]">
                {selected.description}
              </p>
            </div>
            <div className="shrink-0 border-t border-[var(--border)] p-4">
              <Button
                type="button"
                className="min-h-12 w-full text-base"
                onClick={() => openOrder(selected)}
              >
                Заказать печать
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <PrintOrderModal
        open={Boolean(orderArticle)}
        source="world"
        title={orderArticle?.name ?? ""}
        priceNote={
          orderArticle?.priceLabel ? `примерно ${orderArticle.priceLabel}` : null
        }
        sourceUrl={orderArticle?.sourceUrl}
        onClose={() => setOrderArticle(null)}
      />
    </section>
  );
}
