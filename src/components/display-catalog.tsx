"use client";

import { useEffect, useState } from "react";
import { ProductPhoto } from "@/components/product-photo";
import { Badge } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { formatRub } from "@/lib/calculations";
import type { CatalogProduct } from "@/lib/catalog-product";
import { hasListPrice } from "@/lib/pricing";

export function DisplayCatalog({ products }: { products: CatalogProduct[] }) {
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [now, setNow] = useState("");

  useScrollLock(Boolean(selected));

  useEffect(() => {
    function tick() {
      setNow(
        new Date().toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
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
            <h1 className="text-3xl font-bold">Сувениры</h1>
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
            Сувениры пока пуст
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
                          ? "warning"
                          : product.stock <= 2
                            ? "neutral"
                            : "success"
                      }
                    >
                      {product.stock === 0 ? "Нет" : `${product.stock} шт`}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">{selected.name}</h2>
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
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--bg)]"
              >
                Закрыть
              </button>
            </div>
            <div className="mt-5">
              <ProductPhoto
                src={selected.imageUrl}
                alt={selected.name}
                frameClassName="aspect-[4/3] h-auto min-h-72"
              />
            </div>
            {selected.description ? (
              <p className="mt-5 whitespace-pre-wrap text-lg text-[var(--text)]">
                {selected.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
