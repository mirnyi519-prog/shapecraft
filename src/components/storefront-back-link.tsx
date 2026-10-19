"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function StorefrontBackLink() {
  const params = useSearchParams();
  const awayFromGate = Boolean(
    params.get("line") || params.get("p") || params.get("view") === "world",
  );

  if (!awayFromGate) {
    return null;
  }

  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-[var(--brand-dark)] transition hover:bg-[var(--brand-soft)]"
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.5 4.5 7 10l5.5 5.5" />
      </svg>
      Назад
    </Link>
  );
}
