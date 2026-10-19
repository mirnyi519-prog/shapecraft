import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { StorefrontBackLink } from "@/components/storefront-back-link";
import { VisitBeacon } from "@/components/visit-beacon";
import { Button } from "@/components/ui";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="storefront-atmosphere text-[var(--text)]">
      <VisitBeacon enabled={!session} />
      <header className="sticky top-0 z-20 border-b border-[var(--border)]/70 bg-white/75 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
        <div className="page-gutter mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 sm:py-3.5">
          <div className="min-w-0">
            <Suspense fallback={null}>
              <StorefrontBackLink />
            </Suspense>
          </div>
          <Link
            href="/"
            className="justify-self-center truncate text-center text-base font-bold text-[var(--brand)] sm:text-lg"
          >
            ShapeCraft
          </Link>
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
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
            ) : null}
          </div>
        </div>
      </header>
      <main className="page-gutter page-bottom mx-auto max-w-6xl py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
