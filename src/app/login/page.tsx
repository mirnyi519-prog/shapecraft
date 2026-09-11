import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/forms";
import { ShopMarkIcon } from "@/components/shop-mark";
import { isIpBlocked } from "@/lib/access-control";
import { destroySession, getSession, SESSION_COOKIE } from "@/lib/auth";
import { getRequestIp } from "@/lib/request-ip";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  // Старая cookie после сброса сессий: JWT ещё есть, epoch уже нет
  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_COOKIE)?.value) {
    await destroySession();
  }

  const ip = await getRequestIp();
  const loginBlocked = await isIpBlocked(ip);

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
          <LoginForm initiallyBlocked={loginBlocked} />
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
