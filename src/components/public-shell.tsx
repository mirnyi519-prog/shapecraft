import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { StorefrontBackLink } from "@/components/storefront-back-link";
import { VisitBeacon } from "@/components/visit-beacon";
import { Button } from "@/components/ui";
import { buildWhatsAppUrl } from "@/lib/store-contact";

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
            ) : (
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Написать в WhatsApp"
                title="Написать в WhatsApp"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#25D366] transition hover:bg-[#25D366]/10"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </header>
      <main className="page-gutter page-bottom mx-auto max-w-6xl py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
