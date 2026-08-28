import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link href="/" className="text-xl font-bold text-[var(--brand)]">
              ShapeCraft
            </Link>
            <p className="text-sm text-[var(--muted)]">3D-игрушки · shapecraft.ru</p>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="hidden text-sm text-[var(--muted)] sm:inline">
                  {session.name}
                </span>
                <Link href="/dashboard">
                  <Button variant="secondary">Управление</Button>
                </Link>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login">
                <Button>Вход</Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
