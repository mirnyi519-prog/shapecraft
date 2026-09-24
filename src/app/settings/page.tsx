import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";

const SECTIONS = [
  {
    href: "/settings/hours",
    title: "График работы",
    text: "Лето / зима, период зимы, часы по дням",
  },
  {
    href: "/settings/banner",
    title: "Баннер",
    text: "Текст и картинка сверху на витрине",
  },
  {
    href: "/settings/categories",
    title: "Разделы",
    text: "Фильтры каталога на витрине",
  },
  {
    href: "/settings/world",
    title: "В мире",
    text: "Еженедельная подборка трендов",
  },
  {
    href: "/settings/security",
    title: "Безопасность",
    text: "Блокировки IP, журнал, Telegram",
  },
] as const;

export default async function SettingsHubPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Настройки</h1>
          <p className="text-[var(--muted)]">
            Витрина, контент и безопасность — в одном месте
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card
                title={item.title}
                className="h-full transition hover:border-[var(--brand)] hover:shadow-md"
              >
                <p className="text-sm text-[var(--muted)]">{item.text}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
