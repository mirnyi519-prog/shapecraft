import Link from "next/link";
import { getSession, isAdmin } from "@/lib/auth";
import { getAppNavItems } from "@/components/app-nav-config";
import {
  DesktopAppSidebar,
  MobileAppNav,
} from "@/components/app-navigation";
import { LogoutButton } from "@/components/logout-button";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const admin = session ? isAdmin(session.role) : false;
  const navItems = getAppNavItems(admin);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <DesktopAppSidebar items={navItems} userName={session?.name} />

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4 lg:justify-end lg:py-3">
            <div className="min-w-0 lg:hidden">
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
              <span className="hidden max-w-[8rem] truncate text-sm text-[var(--muted)] sm:inline lg:hidden">
                {session?.name}
              </span>
              <LogoutButton />
            </div>
          </div>
          <MobileAppNav items={navItems} />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-4 pb-10 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
