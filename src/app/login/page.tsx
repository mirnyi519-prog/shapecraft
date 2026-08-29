import Link from "next/link";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/forms";
import { ShopMarkIcon } from "@/components/shop-mark";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-white text-[var(--brand)] shadow-sm">
            <ShopMarkIcon className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--brand)]">ShapeCraft</h1>
          <p className="mt-2 text-[var(--muted)]">Учёт продаж и расчётов 50/50</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Вход по логину</p>
        </div>
        <Card title="Вход">
          <LoginForm />
        </Card>
        <p className="mt-4 text-center">
          <Link href="/" className="text-sm text-[var(--muted)] underline-offset-2 hover:underline">
            ← На витрину
          </Link>
        </p>
      </div>
    </div>
  );
}
