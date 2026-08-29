import Link from "next/link";
import { getSession, isAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const admin = session ? isAdmin(session.role) : false;

  const navItems = [
    { href: "/", label: "Витрина" },
    { href: "/dashboard", label: "Сводка" },
    { href: "/products", label: "Товары" },
    { href: "/sales", label: "Продажи" },
    { href: "/sales/new", label: "+ Продажа" },
    { href: "/settlements", label: "Расчёты" },
    ...(admin ? [{ href: "/receipts", label: "Приход" }] : []),
    ...(admin ? [{ href: "/users", label: "Пользователи" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/"
              className="block truncate text-lg font-bold text-[var(--brand)] sm:text-xl"
            >
              ShapeCraft
            </Link>
            <p className="truncate text-xs text-[var(--muted)] sm:text-sm">
              shapecraft.ru
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[8rem] truncate text-sm text-[var(--muted)] sm:inline">
              {session?.name}
            </span>
            <LogoutButton />
          </div>
        </div>
        <nav className="-mx-0 flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] mx-auto [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--bg)] active:bg-[var(--brand-soft)] sm:px-4"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 pb-10 sm:py-6">{children}</main>
    </div>
  );
}
