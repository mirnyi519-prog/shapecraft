"use client";

import { useEffect, useState } from "react";
import { ModalCloseButton } from "@/components/modal-close-button";
import { ProductPhoto } from "@/components/product-photo";
import { Badge } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { formatDateTime, formatRub } from "@/lib/calculations";
import type { CatalogProduct } from "@/lib/catalog-product";
import { stockBadgeLabel, stockBadgeShort } from "@/lib/catalog-product";
import { hasListPrice } from "@/lib/pricing";

export function DisplayCatalog({ products }: { products: CatalogProduct[] }) {
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [now, setNow] = useState("");

  useScrollLock(Boolean(selected));

  useEffect(() => {
    function tick() {
      setNow(formatDateTime(new Date()));
    }

    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <header className="border-b border-[var(--border)] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[var(--brand)]">
              ShapeCraft
            </p>
            <h1 className="text-3xl font-bold">Каталог</h1>
            <p className="mt-1 text-[var(--muted)]">Актуальные цены и остатки</p>
          </div>
          {now ? (
            <p className="text-right text-sm text-[var(--muted)]">
              Обновлено {now}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center text-lg text-[var(--muted)]">
            Каталог пока пуст
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const priced = hasListPrice(product.listPrice);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelected(product)}
                  className="rounded-3xl border border-[var(--border)] bg-white p-4 text-left shadow-sm transition hover:border-[var(--brand)] hover:shadow-md"
                >
                  <ProductPhoto
                    src={product.imageUrl}
                    alt={product.name}
                    frameClassName="aspect-[4/3] h-auto min-h-52"
                  />
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <h2 className="text-2xl font-bold">{product.name}</h2>
                    <Badge
                      tone={
                        product.stock === 0
                          ? product.zeroStockMode === "soon"
                            ? "neutral"
                            : "warning"
                          : product.stock <= 2
                            ? "neutral"
                            : "success"
                      }
                    >
                      {stockBadgeShort(product)}
                    </Badge>
                  </div>
                  {priced ? (
                    <p className="mt-3 text-3xl font-bold text-[var(--brand)]">
                      {formatRub(product.listPrice as number)}
                    </p>
                  ) : (
                    <p className="mt-3 text-xl font-semibold text-red-700">
                      Цена уточняется
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/50 p-6"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-white/95 px-6 py-4 backdrop-blur">
              <div className="min-w-0 pr-2">
                <h2 className="text-3xl font-bold">{selected.name}</h2>
                <div className="mt-2">
                  <Badge
                    tone={
                      selected.stock === 0
                        ? selected.zeroStockMode === "soon"
                          ? "neutral"
                          : "warning"
                        : selected.stock <= 2
                          ? "neutral"
                          : "success"
                    }
                  >
                    {stockBadgeLabel(selected)}
                  </Badge>
                </div>
                {hasListPrice(selected.listPrice) ? (
                  <p className="mt-2 text-3xl font-bold text-[var(--brand)]">
                    {formatRub(selected.listPrice as number)}
                  </p>
                ) : (
                  <p className="mt-2 text-xl font-semibold text-red-700">
                    Цена уточняется
                  </p>
                )}
              </div>
              <ModalCloseButton onClick={() => setSelected(null)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              <ProductPhoto
                src={selected.imageUrl}
                alt={selected.name}
                frameClassName="aspect-[4/3] h-auto min-h-72"
              />
              {selected.description ? (
                <p className="mt-5 whitespace-pre-wrap text-lg text-[var(--text)]">
                  {selected.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
