"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

/**
 * Кнопка открывает окно выбора поверх страницы.
 * Не раскрываем панель в потоке: на телефоне сдвиг вёрстки
 * пробивал клик в первую карточку товара.
 */
export function PriceListPrint({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">{children}</div>
      <button
        type="button"
        className="relative z-10 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--text)] transition hover:bg-[var(--bg)] active:bg-[var(--brand-soft)] active:text-[var(--brand)]"
        title="Печать"
        aria-label="Печать"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <PrinterIcon />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-choice-title"
            className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-5"
          >
            <h2 id="print-choice-title" className="text-lg font-semibold">
              Что напечатать
            </h2>
            <div className="mt-4 grid gap-2">
              <Link
                href="/dashboard/price-print"
                className="flex min-h-12 items-center rounded-xl bg-[var(--brand)] px-4 text-base font-medium text-white"
                onClick={() => setOpen(false)}
              >
                Прайс
              </Link>
              <Link
                href="/dashboard/qr-print"
                className="flex min-h-12 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-base font-medium"
                onClick={() => setOpen(false)}
              >
                QR-код
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
