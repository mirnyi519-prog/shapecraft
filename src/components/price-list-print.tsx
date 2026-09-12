"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

function priceLabel(listPrice: number | null): string {
  return hasListPrice(listPrice) ? formatRub(listPrice) : "—";
}

export function PriceListPrint({
  products,
  children,
}: {
  products: PriceListProduct[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const root = document.getElementById("price-list-print-root");
    root?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  function handlePrint() {
    // Отдельная страница: window.print() по жесту пользователя
    // работает на iPhone/Android, в отличие от скрытого iframe.
    router.push("/dashboard/price-print");
  }

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
          className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Прайс</h2>
              <p className="text-sm text-[var(--muted)]">
                Список товаров для печати · {products.length} поз.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => setOpen(false)}
              >
                Скрыть
              </Button>
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto"
                onClick={handlePrint}
              >
                Печать / PDF
              </Button>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Нет активных товаров для прайса.
            </p>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {products.map((product) => (
                  <li
                    key={product.id}
                    className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"
                  >
                    <ProductThumb
                      src={product.imageUrl}
                      alt={product.name}
                      size={56}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{product.name}</p>
                      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-[var(--brand)]">
                          {priceLabel(product.listPrice)}
                        </span>
                        <span className="text-[var(--muted)]">
                          Остаток: {product.stock} шт
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Фото</th>
                        <th className="px-4 py-2.5 font-medium">Название</th>
                        <th className="px-4 py-2.5 font-medium text-right">
                          Прайс
                        </th>
                        <th className="px-4 py-2.5 font-medium text-right">
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
                          <td className="px-4 py-2">
                            <ProductThumb
                              src={product.imageUrl}
                              alt={product.name}
                              size={48}
                            />
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {product.name}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {priceLabel(product.listPrice)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {product.stock} шт
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
