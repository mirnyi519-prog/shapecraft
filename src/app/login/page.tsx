import { Card } from "@/components/ui";
import { LoginForm } from "@/components/forms";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[var(--brand)]">ShapeCraft</h1>
          <p className="mt-2 text-[var(--muted)]">Учёт продаж и расчётов 50/50</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Вход по логину, не по почте</p>
        </div>
        <Card title="Вход">
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
