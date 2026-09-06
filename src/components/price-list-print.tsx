"use client";

import { useState } from "react";
import { ProductThumb } from "@/components/product-thumb";
import { Button } from "@/components/ui";
import { formatRub } from "@/lib/calculations";
import { hasListPrice } from "@/lib/pricing";

export type PriceListProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  listPrice: number | null;
  stock: number;
};

function PrinterIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 14h12v7H6v-7z"
      />
    </svg>
  );
}

export function PriceListPrint({
  products,
  children,
}: {
  products: PriceListProduct[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{children}</div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border transition ${
            open
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
              : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--bg)]"
          }`}
          aria-expanded={open}
          aria-controls="price-list-print-root"
          title="Прайс для печати"
        >
          <PrinterIcon />
          <span className="sr-only">Прайс для печати</span>
        </button>
      </div>

      {open ? (
        <div
          id="price-list-print-root"
          className="price-list-print-root space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Прайс</h2>
              <p className="text-sm text-[var(--muted)]">
                Список товаров для печати · {products.length} поз.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Скрыть
              </Button>
              <Button type="button" onClick={() => window.print()}>
                Печать
              </Button>
            </div>
          </div>

          <div className="print-price-sheet">
            <div className="mb-4 hidden print:block">
              <h1 className="text-xl font-bold">ShapeCraft — прайс</h1>
              <p className="text-sm text-[var(--muted)]">
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date())}
              </p>
            </div>

            {products.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Нет активных товаров для прайса.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] print:rounded-none print:border-black">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] print:bg-transparent">
                      <tr>
                        <th className="px-3 py-2.5 font-medium sm:px-4">Фото</th>
                        <th className="px-3 py-2.5 font-medium sm:px-4">
                          Название
                        </th>
                        <th className="px-3 py-2.5 font-medium text-right sm:px-4">
                          Прайс
                        </th>
                        <th className="px-3 py-2.5 font-medium text-right sm:px-4">
                          Остаток
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr
                          key={product.id}
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <td className="px-3 py-2 sm:px-4">
                            <ProductThumb
                              src={product.imageUrl}
                              alt={product.name}
                              size={48}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium sm:px-4">
                            {product.name}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold sm:px-4">
                            {hasListPrice(product.listPrice)
                              ? formatRub(product.listPrice)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right sm:px-4">
                            {product.stock} шт
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
