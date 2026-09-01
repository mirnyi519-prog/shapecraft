import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { ShopMark } from "@/components/shop-mark";
import { Button } from "@/components/ui";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();

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
              3D-сувениры · shapecraft.ru
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {session ? (
              <>
                <span className="hidden max-w-[9rem] truncate text-sm text-[var(--muted)] sm:inline">
                  {session.name}
                </span>
                <Link href="/dashboard">
                  <Button variant="secondary" className="min-h-11 px-3 sm:px-4">
                    Управление
                  </Button>
                </Link>
                <LogoutButton />
              </>
            ) : (
              <ShopMark href="/login" label="Вход" />
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 pb-10 sm:py-6">{children}</main>
    </div>
  );
}
