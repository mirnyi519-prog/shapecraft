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
    ...(admin ? [{ href: "/users", label: "Пользователи" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link href="/" className="text-xl font-bold text-[var(--brand)]">
              ShapeCraft
            </Link>
            <p className="text-sm text-[var(--muted)]">shapecraft.ru</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[var(--muted)] sm:inline">
              {session?.name}
            </span>
            <LogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--bg)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
