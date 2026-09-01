"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type AppNavItem,
  isNavItemActive,
} from "@/components/app-nav-config";
import { NavIcon } from "@/components/nav-icon";

function mobileLinkClass(active: boolean): string {
  return [
    "shrink-0 rounded-full px-3 py-2.5 text-sm font-medium transition sm:px-4",
    active
      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
      : "text-[var(--text)] hover:bg-[var(--bg)] active:bg-[var(--brand-soft)]",
  ].join(" ");
}

function desktopLinkClass(active: boolean): string {
  return [
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
    active
      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
      : "text-[var(--text)] hover:bg-[var(--bg)]",
  ].join(" ");
}

export function MobileAppNav({ items }: { items: AppNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="-mx-0 mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={mobileLinkClass(active)}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopAppSidebar({
  items,
  userName,
}: {
  items: AppNavItem[];
  userName?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--border)] bg-white lg:flex">
      <div className="border-b border-[var(--border)] px-4 py-5">
        <Link href="/" className="block">
          <span className="text-lg font-bold text-[var(--brand)]">ShapeCraft</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">shapecraft.ru</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={desktopLinkClass(active)}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {userName ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <p className="truncate text-sm text-[var(--muted)]">{userName}</p>
        </div>
      ) : null}
    </aside>
  );
}
