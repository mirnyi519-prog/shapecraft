"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type AppNavItem,
  isNavGroupActive,
  isNavItemActive,
} from "@/components/app-nav-config";
import { NavIcon } from "@/components/nav-icon";

/** На телефоне в первой полосе — операционка; витрина и прочее в «Ещё». */
const MOBILE_PRIMARY_ORDER = ["/products", "/dashboard", "/sales"] as const;
const MOBILE_PRIMARY_HREFS = new Set<string>(MOBILE_PRIMARY_ORDER);

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

function desktopChildClass(active: boolean): string {
  return [
    "block rounded-lg px-3 py-2 text-sm transition",
    active
      ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
      : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]",
  ].join(" ");
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DesktopNavGroup({ item }: { item: AppNavItem }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const groupActive = isNavGroupActive(pathname, item);
  const [open, setOpen] = useState(groupActive);

  useEffect(() => {
    if (groupActive) {
      setOpen(true);
    }
  }, [groupActive]);

  if (!item.children?.length) {
    const active = isNavItemActive(pathname, item.href, search);
    return (
      <li>
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
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${desktopLinkClass(groupActive)} w-full`}
        aria-expanded={open}
      >
        <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <ul className="mt-1 space-y-0.5 border-l border-[var(--border)] ml-5 pl-2">
          {item.children.map((child) => {
            const active = isNavItemActive(pathname, child.href, search);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={desktopChildClass(active)}
                  aria-current={active ? "page" : undefined}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function MobileNavEntry({
  item,
  search,
  expandedHref,
  setExpandedHref,
  onNavigate,
}: {
  item: AppNavItem;
  search: string;
  expandedHref: string | null;
  setExpandedHref: (href: string | null) => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  if (!item.children?.length) {
    const active = isNavItemActive(pathname, item.href, search);
    return (
      <Link
        href={item.href}
        className={mobileLinkClass(active)}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  }

  const groupActive = isNavGroupActive(pathname, item);
  const open = expandedHref === item.href;
  return (
    <button
      type="button"
      onClick={() =>
        setExpandedHref(open ? null : item.href)
      }
      className={`${mobileLinkClass(open || groupActive)} inline-flex items-center gap-1`}
      aria-expanded={open}
    >
      {item.label}
      <Chevron open={open} />
    </button>
  );
}

function MobileNavChildren({
  item,
  search,
  onNavigate,
}: {
  item: AppNavItem;
  search: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  if (!item.children?.length) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      {item.children.map((child) => {
        const active = isNavItemActive(pathname, child.href, search);
        return (
          <Link
            key={child.href}
            href={child.href}
            className={`${mobileLinkClass(active)} w-full text-left`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            {child.label}
          </Link>
        );
      })}
    </div>
  );
}

export function MobileAppNav({ items }: { items: AppNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [expandedHref, setExpandedHref] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const { primary, more } = useMemo(() => {
    const primaryItems: AppNavItem[] = [];
    const moreItems: AppNavItem[] = [];
    for (const item of items) {
      if (MOBILE_PRIMARY_HREFS.has(item.href)) {
        primaryItems.push(item);
      } else {
        moreItems.push(item);
      }
    }
    primaryItems.sort(
      (a, b) =>
        MOBILE_PRIMARY_ORDER.indexOf(
          a.href as (typeof MOBILE_PRIMARY_ORDER)[number],
        ) -
        MOBILE_PRIMARY_ORDER.indexOf(
          b.href as (typeof MOBILE_PRIMARY_ORDER)[number],
        ),
    );
    return { primary: primaryItems, more: moreItems };
  }, [items]);

  const moreActive = useMemo(
    () => more.some((item) => isNavGroupActive(pathname, item)),
    [more, pathname],
  );

  function closeMenus() {
    setExpandedHref(null);
    setMoreOpen(false);
  }

  // После перехода по ссылке подменю не держим открытым
  useEffect(() => {
    setExpandedHref(null);
    setMoreOpen(false);
  }, [pathname, search]);

  const expandedItem =
    [...primary, ...more].find((item) => item.href === expandedHref) ?? null;

  return (
    <nav className="mx-auto max-w-6xl px-4 pb-3 lg:hidden">
      <div className="touch-scroll flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {primary.map((item) => (
          <MobileNavEntry
            key={item.href}
            item={item}
            search={search}
            expandedHref={expandedHref}
            setExpandedHref={(href) => {
              setMoreOpen(false);
              setExpandedHref(href);
            }}
            onNavigate={closeMenus}
          />
        ))}
        {more.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setExpandedHref(null);
              setMoreOpen((value) => !value);
            }}
            className={`${mobileLinkClass(moreOpen || moreActive)} inline-flex items-center gap-1`}
            aria-expanded={moreOpen}
          >
            Ещё
            <Chevron open={moreOpen} />
          </button>
        ) : null}
      </div>

      {expandedItem && primary.some((item) => item.href === expandedItem.href) ? (
        <MobileNavChildren
          item={expandedItem}
          search={search}
          onNavigate={closeMenus}
        />
      ) : null}

      {moreOpen && more.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-white p-2 shadow-sm">
          {more.map((item) => {
            if (!item.children?.length) {
              const active = isNavItemActive(pathname, item.href, search);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${mobileLinkClass(active)} w-full text-left`}
                  aria-current={active ? "page" : undefined}
                  onClick={closeMenus}
                >
                  {item.label}
                </Link>
              );
            }

            const groupActive = isNavGroupActive(pathname, item);
            const open = expandedHref === item.href;
            return (
              <div key={item.href} className="col-span-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedHref((current) =>
                      current === item.href ? null : item.href,
                    )
                  }
                  className={`${mobileLinkClass(open || groupActive)} inline-flex w-full items-center justify-between gap-1`}
                  aria-expanded={open}
                >
                  {item.label}
                  <Chevron open={open} />
                </button>
                {open ? (
                  <MobileNavChildren
                    item={item}
                    search={search}
                    onNavigate={closeMenus}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
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
          {items.map((item) => (
            <DesktopNavGroup key={item.href} item={item} />
          ))}
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
