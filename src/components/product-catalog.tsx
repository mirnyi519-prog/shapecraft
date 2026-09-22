"use client";

import { useEffect, useMemo, useState } from "react";
import { BuyIntentModal } from "@/components/buy-intent-modal";
import { FeedbackModal } from "@/components/feedback-modal";
import { ModalCloseButton } from "@/components/modal-close-button";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPhoto } from "@/components/product-photo";
import { ProductSpecsBlock } from "@/components/product-specs-block";
import { Badge, Button, Card } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { formatRub } from "@/lib/calculations";
import type { CatalogCategory } from "@/lib/categories";
import type { CatalogProduct } from "@/lib/catalog-product";
import {
  stockBadgeLabel,
  stockBadgeShort,
  storefrontCtaLabel,
} from "@/lib/catalog-product";
import { hasListPrice } from "@/lib/pricing";

export type { CatalogProduct };

function syncProductQuery(productId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (productId) {
    url.searchParams.set("p", productId);
  } else {
    url.searchParams.delete("p");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", next);
}

function findCatalogProduct(
  productId: string,
  lists: CatalogProduct[][],
): CatalogProduct | null {
  for (const list of lists) {
    const found = list.find((item) => item.id === productId);
    if (found) {
      return found;
    }
  }
  return null;
}

function ProductCard({
  product,
  showCost,
  compact = false,
  onSelect,
}: {
  product: CatalogProduct;
  showCost: boolean;
  compact?: boolean;
  onSelect: (product: CatalogProduct) => void;
}) {
  const cardPriced = hasListPrice(product.listPrice);

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={`text-left ${compact ? "w-[17rem] shrink-0 sm:w-[19rem]" : "w-full"}`}
    >
      <Card
        className={`h-full transition hover:border-[var(--brand)] hover:shadow-md ${
          cardPriced ? "" : "border-red-300 bg-red-50/80"
        }`}
      >
        <div className="space-y-3">
          <ProductPhoto
            src={product.imageUrl}
            alt={product.name}
            frameClassName={
              compact
                ? "aspect-[4/3] h-auto min-h-36"
                : "aspect-[4/3] h-auto min-h-44 sm:min-h-48"
            }
          />
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2
                className={`font-semibold ${compact ? "text-base" : "text-base sm:text-lg"}`}
              >
                {product.name}
              </h2>
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
            {!compact && product.categories.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {product.categories.map((category) => (
                  <span
                    key={category.id}
                    className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            ) : null}
            {!compact && product.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                {product.description}
              </p>
            ) : null}
            {cardPriced ? (
              <p
                className={`mt-2 font-bold text-[var(--brand)] ${
                  compact ? "text-lg" : "text-xl"
                }`}
              >
                {formatRub(product.listPrice as number)}
              </p>
            ) : (
              <p className="mt-2 text-base font-semibold text-red-700">
                Цена уточняется
              </p>
            )}
            {showCost && product.costPrice !== undefined ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                Себестоимость {formatRub(product.costPrice)}
              </p>
            ) : null}
            {!compact ? (
              <p className="mt-3 text-sm font-medium text-[var(--brand)]">
                Подробнее →
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </button>
  );
}

function HighlightStrip({
  title,
  badge,
  products,
  showCost,
  onSelect,
}: {
  title: string;
  badge: string;
  products: CatalogProduct[];
  showCost: boolean;
  onSelect: (product: CatalogProduct) => void;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge tone="warning">{badge}</Badge>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showCost={showCost}
            compact
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export function ProductCatalog({
  products,
  categories = [],
  newProducts = [],
  popularProducts = [],
  showCost = false,
  catalogLineLabel = "Сувениры",
  initialProductId = null,
}: {
  products: CatalogProduct[];
  categories?: CatalogCategory[];
  newProducts?: CatalogProduct[];
  popularProducts?: CatalogProduct[];
  showCost?: boolean;
  catalogLineLabel?: string;
  initialProductId?: string | null;
}) {
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useScrollLock(Boolean(selected) || buyOpen || feedbackOpen);

  function openProduct(product: CatalogProduct) {
    setFeedbackOpen(false);
    setBuyOpen(false);
    setLinkCopied(false);
    setSelected(product);
    syncProductQuery(product.id);
  }

  function closeProduct() {
    setFeedbackOpen(false);
    setBuyOpen(false);
    setLinkCopied(false);
    setSelected(null);
    syncProductQuery(null);
  }

  async function handleBuyClick() {
    if (!selected) {
      return;
    }
    setBuyOpen(true);
    try {
      await fetch(`/api/products/${selected.id}/buy-click`, { method: "POST" });
    } catch {
      // клик всё равно открыл модалку; пуш не критичен для UX
    }
  }

  async function handleCopyLink() {
    if (!selected || typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("p", selected.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!initialProductId) {
      return;
    }
    const found = findCatalogProduct(initialProductId, [
      products,
      newProducts,
      popularProducts,
    ]);
    if (found) {
      setSelected(found);
      syncProductQuery(found.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- открытие только по ?p= при загрузке
  }, [initialProductId]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !feedbackOpen && !buyOpen) {
        closeProduct();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, feedbackOpen, buyOpen]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    void fetch(`/api/products/${selected.id}/view`, { method: "POST" }).catch(
      () => {},
    );
  }, [selected?.id]);

  const filteredProducts = useMemo(() => {
    if (!categoryId) {
      return products;
    }
    return products.filter((product) =>
      product.categories.some((category) => category.id === categoryId),
    );
  }, [products, categoryId]);

  const priced = selected ? hasListPrice(selected.listPrice) : false;
  const ctaLabel = selected ? storefrontCtaLabel(selected) : "Купить";
  const hasHighlights =
    !categoryId && (newProducts.length > 0 || popularProducts.length > 0);

  if (products.length === 0 && !hasHighlights) {
    return (
      <Card>
        <p className="text-[var(--muted)]">
          Каталог «{catalogLineLabel}» пока пуст — скоро появятся новые позиции.
        </p>
      </Card>
    );
  }

  return (
    <>
      {categories.length > 0 ? (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
              categoryId === null
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--bg)]"
            }`}
          >
            Все
          </button>
          {categories.map((category) => {
            const active = categoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--bg)]"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {hasHighlights ? (
        <div className="mb-8 space-y-6">
          <HighlightStrip
            title="Новинки"
            badge="новое"
            products={newProducts}
            showCost={showCost}
            onSelect={openProduct}
          />
          <HighlightStrip
            title="Популярное"
            badge="хит"
            products={popularProducts}
            showCost={showCost}
            onSelect={openProduct}
          />
        </div>
      ) : null}

      {filteredProducts.length > 0 ? (
        <>
          <h2 className="mb-4 text-lg font-semibold">
            {categoryId
              ? categories.find((item) => item.id === categoryId)?.name ?? "Раздел"
              : `Все · ${catalogLineLabel}`}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showCost={showCost}
                onSelect={openProduct}
              />
            ))}
          </div>
        </>
      ) : (
        <Card>
          <p className="text-[var(--muted)]">
            В этом разделе пока нет позиций.
          </p>
        </Card>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-black/50 p-3 sm:items-center sm:p-4"
          onClick={closeProduct}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            className="flex max-h-[min(92vh,100dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-5">
              <div className="min-w-0 pr-2">
                <h2 id="product-dialog-title" className="text-xl font-bold sm:text-2xl">
                  {selected.name}
                </h2>
                {selected.categories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.categories.map((category) => (
                      <span
                        key={category.id}
                        className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--muted)]"
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {priced ? (
                    <p className="text-xl font-bold text-[var(--brand)]">
                      {formatRub(selected.listPrice as number)}
                    </p>
                  ) : (
                    <p className="text-base font-semibold text-red-700">
                      Цена уточняется
                    </p>
                  )}
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
              </div>
              <ModalCloseButton onClick={closeProduct} />
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <ProductGallery
                images={
                  selected.imageUrls?.length
                    ? selected.imageUrls
                    : selected.imageUrl
                      ? [selected.imageUrl]
                      : []
                }
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
            </div>

            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--border)] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="min-h-11 flex-1"
                onClick={() => void handleBuyClick()}
              >
                {ctaLabel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                onClick={() => void handleCopyLink()}
              >
                {linkCopied ? "Ссылка скопирована" : "Скопировать ссылку"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                onClick={() => setFeedbackOpen(true)}
              >
                Обратная связь
              </Button>
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

      <BuyIntentModal
        open={buyOpen}
        productName={selected?.name}
        title={ctaLabel}
        onClose={() => setBuyOpen(false)}
      />
    </>
  );
}
