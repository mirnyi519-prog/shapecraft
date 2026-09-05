"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ProductAdminCard,
  type ProductCardData,
} from "@/components/product-admin-card";
import { Card } from "@/components/ui";
import { hasListPrice } from "@/lib/pricing";

type FilterChip = "all" | "archive" | "no-price" | "low-stock" | "in-stock" | "out";

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

const CHIPS: { id: FilterChip; label: string; adminOnly?: boolean }[] = [
  { id: "all", label: "На витрине" },
  { id: "archive", label: "Архив", adminOnly: true },
  { id: "no-price", label: "Без прайса" },
  { id: "low-stock", label: "Мало" },
  { id: "in-stock", label: "В наличии" },
  { id: "out", label: "Нет в наличии" },
];

export function ProductsBrowser({
  products,
  categories = [],
  isAdmin,
}: {
  products: ProductCardData[];
  categories?: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const byChip = products.filter((product) => {
      switch (chip) {
        case "archive":
          return !product.active;
        case "no-price":
          return product.active && !hasListPrice(product.listPrice);
        case "low-stock":
          return product.active && product.stock > 0 && product.stock <= 2;
        case "in-stock":
          return product.active && product.stock > 0;
        case "out":
          return product.active && product.stock === 0;
        default:
          return product.active;
      }
    });

    const byCategory = categoryId
      ? byChip.filter((product) =>
          product.categories.some((category) => category.id === categoryId),
        )
      : byChip;

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
      return byCategory;
    }

    return byCategory
      .map((product) => ({
        product,
        score: scoreProduct(product, tokens),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.product);
  }, [products, chip, categoryId, deferredQuery]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Поиск</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, раздел, описание, цена, «без прайса», «мало»…"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base outline-none ring-[var(--brand)] focus:ring-2"
            autoComplete="off"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHIPS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active = chip === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setChip(item.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {categories.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Раздел</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                  categoryId === null
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-white"
                }`}
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
                    className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-[var(--brand)] text-white"
                        : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-white"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <p className="text-sm text-[var(--muted)]">
          Найдено: {filtered.length} из {products.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)]">
            Ничего не найдено. Попробуйте другое слово или сбросьте фильтр.
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
