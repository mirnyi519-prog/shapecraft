"use client";

import { useEffect, useState } from "react";
import { FeedbackModal } from "@/components/feedback-modal";
import { ProductPhoto } from "@/components/product-photo";
import { ProductSpecsBlock } from "@/components/product-specs-block";
import { Badge, Button, Card } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { formatRub } from "@/lib/calculations";
import { hasListPrice } from "@/lib/pricing";

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  listPrice: number | null;
  stock: number;
  weightGrams: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  costPrice?: number;
};

export function ProductCatalog({
  products,
  showCost = false,
}: {
  products: CatalogProduct[];
  showCost?: boolean;
}) {
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useScrollLock(Boolean(selected));

  function closeProduct() {
    setFeedbackOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    if (!selected) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !feedbackOpen) {
        closeProduct();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, feedbackOpen]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    void fetch(`/api/products/${selected.id}/view`, { method: "POST" }).catch(() => {});
  }, [selected?.id]);

  if (products.length === 0) {
    return (
      <Card>
        <p className="text-[var(--muted)]">Каталог пока пуст — скоро появятся новые игрушки.</p>
      </Card>
    );
  }

  const priced = selected ? hasListPrice(selected.listPrice) : false;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const cardPriced = hasListPrice(product.listPrice);
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelected(product)}
              className="text-left"
            >
              <Card
                className={`h-full transition hover:border-[var(--brand)] hover:shadow-md ${
                  cardPriced ? "" : "border-red-300 bg-red-50/80"
                }`}
              >
                <div className="space-y-4">
                  <ProductPhoto
                    src={product.imageUrl}
                    alt={product.name}
                    frameClassName="aspect-[4/3] h-auto min-h-44 sm:min-h-48"
                  />
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold sm:text-lg">{product.name}</h2>
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
                    {product.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                        {product.description}
                      </p>
                    ) : null}
                    {cardPriced ? (
                      <p className="mt-3 text-xl font-bold text-[var(--brand)]">
                        {formatRub(product.listPrice as number)}
                      </p>
                    ) : (
                      <p className="mt-3 text-base font-semibold text-red-700">
                        Цена уточняется
                      </p>
                    )}
                    {showCost && product.costPrice !== undefined ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Себестоимость {formatRub(product.costPrice)}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm font-medium text-[var(--brand)]">
                      Подробнее →
                    </p>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          onClick={closeProduct}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="product-dialog-title" className="text-2xl font-bold">
                    {selected.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {priced ? (
                      <p className="text-xl font-bold text-[var(--brand)]">
                        {formatRub(selected.listPrice as number)}
                      </p>
                    ) : (
                      <p className="text-base font-semibold text-red-700">Цена уточняется</p>
                    )}
                    <Badge
                      tone={
                        selected.stock === 0
                          ? "warning"
                          : selected.stock <= 2
                            ? "neutral"
                            : "success"
                      }
                    >
                      {selected.stock === 0 ? "Нет в наличии" : `${selected.stock} шт`}
                    </Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeProduct}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--bg)]"
                >
                  Закрыть
                </button>
              </div>

              <ProductPhoto
                src={selected.imageUrl}
                alt={selected.name}
                frameClassName="aspect-[4/3] h-auto min-h-56"
              />

              {selected.description ? (
                <div>
                  <h3 className="text-sm font-medium text-[var(--muted)]">Описание</h3>
                  <p className="mt-2 whitespace-pre-wrap text-[var(--text)]">
                    {selected.description}
                  </p>
                </div>
              ) : null}

              <div>
                <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">
                  Вес и габариты
                </h3>
                <ProductSpecsBlock product={selected} />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  onClick={() => setFeedbackOpen(true)}
                >
                  Обратная связь
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 flex-1"
                  onClick={closeProduct}
                >
                  Закрыть
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        productId={selected?.id}
        productName={selected?.name}
      />
    </>
  );
}
