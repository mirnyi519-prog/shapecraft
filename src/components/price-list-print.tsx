"use client";

import Link from "next/link";

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
 * Кнопка сразу ведёт на /dashboard/price-print.
 * Без раскрывающейся панели: на телефоне после тапа вёрстка
 * сдвигалась и «пробивала» клик в первую карточку товара.
 */
export function PriceListPrint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">{children}</div>
      <Link
        href="/dashboard/price-print"
        className="relative z-10 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--text)] transition hover:bg-[var(--bg)] active:bg-[var(--brand-soft)] active:text-[var(--brand)]"
        title="Прайс для печати"
        aria-label="Прайс для печати"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <PrinterIcon />
      </Link>
    </div>
  );
}
