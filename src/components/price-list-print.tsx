"use client";

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

function absoluteImageUrl(src: string | null): string | null {
  if (!src) {
    return null;
  }
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  if (typeof window === "undefined") {
    return src;
  }
  return new URL(src, window.location.origin).toString();
}

function buildPrintHtml(products: PriceListProduct[]): string {
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const rows = products
    .map((product) => {
      const image = absoluteImageUrl(product.imageUrl);
      const thumb = image
        ? `<img src="${image}" alt="" width="48" height="48" style="width:48px;height:48px;object-fit:contain;border-radius:6px;background:#fff3eb;" />`
        : `<div style="width:48px;height:48px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#808081;font-size:12px;">—</div>`;

      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:middle;">${thumb}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:middle;font-weight:600;">${escapeHtml(product.name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:middle;text-align:right;white-space:nowrap;">${escapeHtml(priceLabel(product.listPrice))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:middle;text-align:right;white-space:nowrap;">${product.stock} шт</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ShapeCraft — прайс</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: Arial, sans-serif;
      color: #1f2937;
      background: #fff;
    }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .meta { margin: 0 0 16px; color: #808081; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #d1d5db;
      color: #808081;
      font-size: 12px;
      font-weight: 600;
    }
    th.num { text-align: right; }
    @media print {
      body { padding: 0; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <h1>ShapeCraft — прайс</h1>
  <p class="meta">${escapeHtml(date)} · ${products.length} поз.</p>
  <table>
    <thead>
      <tr>
        <th>Фото</th>
        <th>Название</th>
        <th class="num">Прайс</th>
        <th class="num">Остаток</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function PriceListPrint({
  products,
  children,
}: {
  products: PriceListProduct[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const root = document.getElementById("price-list-print-root");
    root?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  function handlePrint() {
    const html = buildPrintHtml(products);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument ?? frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      document.body.removeChild(frame);
      window.print();
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    const cleanup = () => {
      frame.remove();
    };

    const runPrint = () => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } finally {
        // iOS sometimes needs a short delay before removing the frame
        window.setTimeout(cleanup, 1000);
      }
    };

    // Wait for images so mobile print isn't blank
    const images = Array.from(frameDocument.images);
    if (images.length === 0) {
      runPrint();
      return;
    }

    let remaining = images.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) {
        runPrint();
      }
    };
    for (const image of images) {
      if (image.complete) {
        done();
      } else {
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
      }
    }
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
                Печать
              </Button>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Нет активных товаров для прайса.
            </p>
          ) : (
            <>
              {/* Мобилка: карточки, без горизонтального скролла */}
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

              {/* Планшет/ПК: таблица */}
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
