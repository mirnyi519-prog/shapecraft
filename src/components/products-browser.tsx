"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  type ProductsView,
} from "@/components/app-nav-config";
import {
  ProductAdminCard,
  type ProductCardData,
} from "@/components/product-admin-card";
import { Card, chromeTab } from "@/components/ui";
import { hasListPrice } from "@/lib/pricing";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreProduct(product: ProductCardData, tokens: string[]): number {
  if (tokens.length === 0) {
    return 1;
  }

  const name = normalize(product.name);
  const description = normalize(product.description ?? "");
  const categories = normalize(product.categories.map((item) => item.name).join(" "));
  const haystack = `${name} ${description} ${categories}`;
  const priced = hasListPrice(product.listPrice);
  let score = 0;

  for (const token of tokens) {
    let matched = false;

    if (
      token === "безцены" ||
      token === "безпрайса" ||
      token === "нетцены" ||
      token === "нетпрайса" ||
      token === "красный"
    ) {
      if (!priced) {
        matched = true;
        score += 5;
      }
    } else if (
      token === "мало" ||
      token === "заканчивается" ||
      token === "малоостатка"
    ) {
      if (product.stock > 0 && product.stock <= 2) {
        matched = true;
        score += 4;
      }
    } else if (
      token === "нет" ||
      token === "пусто" ||
      token === "закончился" ||
      token === "нетвналичии"
    ) {
      if (product.stock === 0) {
        matched = true;
        score += 4;
      }
    } else if (
      token === "есть" ||
      token === "вналичии" ||
      token === "остаток"
    ) {
      if (product.stock > 0) {
        matched = true;
        score += 2;
      }
    } else if (/^\d+([.,]\d+)?$/.test(token)) {
      const num = Number(token.replace(",", "."));
      if (product.stock === num) {
        matched = true;
        score += 6;
      }
      if (priced && product.listPrice === num) {
        matched = true;
        score += 6;
      }
      if (priced && String(product.listPrice).includes(token.replace(",", "."))) {
        matched = true;
        score += 3;
      }
      if (String(product.stock).includes(token)) {
        matched = true;
        score += 2;
      }
    } else if (name.startsWith(token)) {
      matched = true;
      score += 8;
    } else if (name.includes(token)) {
      matched = true;
      score += 5;
    } else if (categories.includes(token)) {
      matched = true;
      score += 6;
    } else if (description.includes(token)) {
      matched = true;
      score += 3;
    } else if (haystack.includes(token)) {
      matched = true;
      score += 1;
    }

    if (!matched) {
      return 0;
    }
  }

  return score;
}

type ProductsSort =
  | "updated"
  | "name"
  | "sold"
  | "revenue"
  | "stock-desc"
  | "stock-asc"
  | "price-desc"
  | "price-asc"
  | "new";

const SORT_OPTIONS: { value: ProductsSort; label: string }[] = [
  { value: "updated", label: "Недавно изменённые" },
  { value: "name", label: "Название (А–Я)" },
  { value: "sold", label: "Продано: больше" },
  { value: "revenue", label: "Выручка: больше" },
  { value: "stock-desc", label: "Остаток: больше" },
  { value: "stock-asc", label: "Остаток: меньше" },
  { value: "price-desc", label: "Цена: дороже" },
  { value: "price-asc", label: "Цена: дешевле" },
  { value: "new", label: "Новые" },
];

function byName(a: ProductCardData, b: ProductCardData): number {
  return a.name.localeCompare(b.name, "ru");
}

function priceOf(product: ProductCardData): number | null {
  return hasListPrice(product.listPrice) ? (product.listPrice as number) : null;
}

function compareProducts(
  a: ProductCardData,
  b: ProductCardData,
  sort: ProductsSort,
): number {
  switch (sort) {
    case "name":
      return byName(a, b);
    case "sold":
      return b.soldQuantity - a.soldQuantity || byName(a, b);
    case "revenue":
      return b.soldAmount - a.soldAmount || byName(a, b);
    case "stock-desc":
      return b.stock - a.stock || byName(a, b);
    case "stock-asc":
      return a.stock - b.stock || byName(a, b);
    case "price-desc":
    case "price-asc": {
      const pa = priceOf(a);
      const pb = priceOf(b);
      if (pa === null || pb === null) {
        return pa === pb ? byName(a, b) : pa === null ? 1 : -1;
      }
      return (sort === "price-desc" ? pb - pa : pa - pb) || byName(a, b);
    }
    case "new":
      return b.createdAt.localeCompare(a.createdAt) || byName(a, b);
    default:
      return b.updatedAt.localeCompare(a.updatedAt) || byName(a, b);
  }
}

function matchesView(product: ProductCardData, view: ProductsView): boolean {
  switch (view) {
    case "archive":
      return !product.active;
    case "no-price":
      return product.active && !hasListPrice(product.listPrice);
    case "out":
      return product.active && product.stock === 0;
    default:
      return product.active;
  }
}

export function ProductsBrowser({
  products,
  categories = [],
  isAdmin,
  view = "all",
}: {
  products: ProductCardData[];
  categories?: { id: string; name: string }[];
  isAdmin: boolean;
  view?: ProductsView;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductsSort>("updated");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const byView = products.filter((product) => matchesView(product, view));

    const byCategory = categoryId
      ? byView.filter((product) =>
          product.categories.some((category) => category.id === categoryId),
        )
      : byView;

    const normalized = normalize(deferredQuery);
    const compact = normalized
      .replace(/\bбез\s+цены\b/g, "безцены")
      .replace(/\bбез\s+прайса\b/g, "безпрайса")
      .replace(/\bнет\s+цены\b/g, "нетцены")
      .replace(/\bнет\s+прайса\b/g, "нетпрайса")
      .replace(/\bнет\s+в\s+наличии\b/g, "нетвналичии")
      .replace(/\bв\s+наличии\b/g, "вналичии")
      .replace(/\bмало\s+остатка\b/g, "малоостатка");

    const tokens = compact.split(" ").filter(Boolean);
    if (tokens.length === 0) {
      return [...byCategory].sort((a, b) => compareProducts(a, b, sort));
    }

    return byCategory
      .map((product) => ({
        product,
        score: scoreProduct(product, tokens),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) =>
        sort === "updated"
          ? b.score - a.score
          : compareProducts(a.product, b.product, sort),
      )
      .map((row) => row.product);
  }, [products, view, categoryId, deferredQuery, sort]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Поиск</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, раздел, описание, цена…"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base outline-none ring-[var(--brand)] focus:ring-2"
            autoComplete="off"
          />
        </label>
        {categories.length > 0 && view !== "archive" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Раздел</p>
            <div className="chrome-tabs in-card">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={chromeTab(categoryId === null)}
              >
                Все разделы
              </button>
              {categories.map((category) => {
                const active = categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={chromeTab(active)}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            Найдено: {filtered.length}
          </p>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className="shrink-0">Сортировка</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ProductsSort)}
              className="min-h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] outline-none transition focus:border-[var(--brand)] sm:w-auto"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)]">
            Ничего не найдено. Попробуйте другое слово или смените раздел.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <ProductAdminCard
              key={product.id}
              product={product}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
