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
    <>
      <div className="h-16" aria-hidden />
      <Link
        href="/"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-[var(--brand-dark)]"
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
    </>
  );
}
