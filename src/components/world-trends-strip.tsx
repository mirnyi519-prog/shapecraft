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
}: {
  article: WorldTrendArticleView;
  onOpen: (article: WorldTrendArticleView) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(article)}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-0 text-left shadow-sm transition hover:border-[var(--brand)]"
    >
      <div className="relative aspect-[4/3] bg-[var(--brand-soft)]">
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardMediaUrl(article.imageUrl) ?? article.imageUrl}
            alt={article.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
            Фото модели
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-semibold leading-snug">{article.name}</h3>
        {article.priceLabel ? (
          <div className="mt-auto">
            <Badge tone="warning">{article.priceLabel}</Badge>
          </div>
        ) : null}
      </div>
    </button>
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
  const [orderOpen, setOrderOpen] = useState(false);
  const visible = expanded || open;
  useScrollLock(Boolean(selected) || orderOpen);

  useEffect(() => {
    if (!selected) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !orderOpen) {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, orderOpen]);

  if (articles.length === 0) {
    return null;
  }

  const grouped = groupArticlesByTier(articles);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Badge tone="neutral">мир</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Идеи, популярные у 3D-печатников · {articles.length} моделей
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
        <div className="space-y-6">
          {WORLD_TIER_ORDER.map((tier) => {
            const tierArticles = grouped[tier];
            if (tierArticles.length === 0) {
              return null;
            }

            return (
              <div key={tier} className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold">
                    {WORLD_TIER_LABELS[tier]}
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    {WORLD_TIER_HINTS[tier]}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {tierArticles.map((article) => (
                    <WorldTrendCard
                      key={article.id}
                      article={article}
                      onOpen={setSelected}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        <div
          className="safe-overlay fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => {
            if (!orderOpen) {
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
                onClick={() => setOrderOpen(true)}
              >
                Заказать
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <PrintOrderModal
        open={orderOpen && Boolean(selected)}
        source="world"
        title={selected?.name ?? ""}
        priceNote={
          selected?.priceLabel ? `примерно ${selected.priceLabel}` : null
        }
        sourceUrl={selected?.sourceUrl}
        onClose={() => setOrderOpen(false)}
      />
    </section>
  );
}
