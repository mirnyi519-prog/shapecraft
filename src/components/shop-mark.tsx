import Link from "next/link";

/** Знак магазина ShapeCraft — иконка входа на витрине */
export function ShopMark({
  href = "/login",
  label = "Вход в магазин",
  className = "",
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-white text-[var(--brand)] shadow-sm transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] active:scale-95 ${className}`}
    >
      <ShopMarkIcon className="h-6 w-6" />
    </Link>
  );
}

export function ShopMarkIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M8 18.5 12.2 10h23.6L40 18.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5h28v19a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2v-19Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M18 39.5V27h12v12.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.5" cy="18.5" r="2" fill="currentColor" />
      <circle cx="24" cy="18.5" r="2" fill="currentColor" />
      <circle cx="32.5" cy="18.5" r="2" fill="currentColor" />
    </svg>
  );
}
