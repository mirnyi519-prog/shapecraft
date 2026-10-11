"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type AppNavItem,
  isNavGroupActive,
  isNavItemActive,
} from "@/components/app-nav-config";
import { LogoutButton } from "@/components/logout-button";
import { NavIcon } from "@/components/nav-icon";

/** На телефоне в первой полосе — ежедневные экраны; остальное в «Ещё». */
const MOBILE_PRIMARY_LABELS = ["Товары", "Сводка", "Продажи"] as const;

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

function DesktopNavGroup({ item, nested = false }: { item: AppNavItem; nested?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const groupActive = isNavGroupActive(pathname, item, search);
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
          className={nested ? desktopChildClass(active) : desktopLinkClass(active)}
          aria-current={active ? "page" : undefined}
        >
          {nested ? null : <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />}
          <span className="truncate">{item.label}</span>
        </Link>
      </li>
    );
  }

  const rowClass = nested ? desktopChildClass(groupActive) : desktopLinkClass(groupActive);

  return (
    <li>
      <div className="flex items-center gap-1">
        <Link
          href={item.href}
          className={`${rowClass} min-w-0 flex-1`}
          aria-current={isNavItemActive(pathname, item.href, search) ? "page" : undefined}
        >
          {nested ? null : <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />}
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--bg)]"
          aria-expanded={open}
          aria-label={open ? `Свернуть «${item.label}»` : `Развернуть «${item.label}»`}
        >
          <Chevron open={open} />
        </button>
      </div>
      {open ? (
        <ul className="mt-1 space-y-0.5 border-l border-[var(--border)] ml-5 pl-2">
          {item.children.map((child) =>
            child.children?.length ? (
              <DesktopNavGroup key={`${child.label}:${child.href}`} item={child} nested />
            ) : (
              <li key={`${child.label}:${child.href}`}>
                <Link
                  href={child.href}
                  className={desktopChildClass(isNavItemActive(pathname, child.href, search))}
                  aria-current={isNavItemActive(pathname, child.href, search) ? "page" : undefined}
                >
                  {child.label}
                </Link>
              </li>
            ),
          )}
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

  const groupActive = isNavGroupActive(pathname, item, search);
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
    function findLabel(list: AppNavItem[], label: string): AppNavItem | undefined {
      for (const item of list) {
        if (item.label === label) {
          return { ...item, children: undefined };
        }
        if (item.children) {
          const found = findLabel(item.children, label);
          if (found) return found;
        }
      }
      return undefined;
    }

    function withoutPrimary(item: AppNavItem): AppNavItem | null {
      if ((MOBILE_PRIMARY_LABELS as readonly string[]).includes(item.label)) {
        return null;
      }
      if (!item.children?.length) return item;
      const children = item.children
        .map(withoutPrimary)
        .filter((child): child is AppNavItem => child !== null);
      if (children.length === 0) return null;
      return { ...item, children };
    }

    const primaryItems = MOBILE_PRIMARY_LABELS.map((label) => findLabel(items, label)).filter(
      (item): item is AppNavItem => Boolean(item),
    );
    const moreItems = items
      .map(withoutPrimary)
      .filter((item): item is AppNavItem => item !== null);
    return { primary: primaryItems, more: moreItems };
  }, [items]);

  const moreActive = useMemo(
    () => more.some((item) => isNavGroupActive(pathname, item, search)),
    [more, pathname, search],
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

            const groupActive = isNavGroupActive(pathname, item, search);
            const open = expandedHref === item.href;
            return (
              <div key={`${item.label}:${item.href}`} className="col-span-2">
                <div className="flex items-center gap-1">
                  <Link
                    href={item.href}
                    className={`${mobileLinkClass(groupActive)} min-w-0 flex-1 text-left`}
                    aria-current={isNavItemActive(pathname, item.href, search) ? "page" : undefined}
                    onClick={closeMenus}
                  >
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedHref((current) =>
                        current === item.href ? null : item.href,
                      )
                    }
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)]"
                    aria-expanded={open}
                    aria-label={open ? `Свернуть «${item.label}»` : `Развернуть «${item.label}»`}
                  >
                    <Chevron open={open} />
                  </button>
                </div>
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
        <Link href="/dashboard" className="block">
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

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-3">
        <p className="min-w-0 truncate text-sm text-[var(--muted)]">{userName ?? "Вход"}</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
