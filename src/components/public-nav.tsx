"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PUBLIC_LINKS = [
  { href: "/", label: "Каталог" },
  { href: "/world", label: "В мире" },
  { href: "/display", label: "Экран" },
];

export function PublicNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-[var(--border)] px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PUBLIC_LINKS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--bg)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
