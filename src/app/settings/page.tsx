import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { getDeliveryOrdersEnabled } from "@/lib/store-settings";

const SECTIONS = [
  {
    href: "/users",
    title: "Пользователи",
    text: "Кто входит в админку",
  },
  {
    href: "/visits",
    title: "Аналитика",
    text: "Посещения витрины и просмотры карточек",
  },
  {
    href: "/feedback",
    title: "Обратная связь",
    text: "Сообщения с витрины",
  },
  {
    href: "/packaging",
    title: "Упаковка",
    text: "Остатки коробок и рекомендации для товаров",
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

  const ordersEnabled = await getDeliveryOrdersEnabled();
  const sections = [
    ...SECTIONS,
    {
      href: "/settings/orders",
      title: "Режим заказов",
      text: ordersEnabled
        ? "Включены. Оформление на витрине ещё не выложено"
        : "Выключены. На витрине нет регистрации и доставки",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Контроль</h1>
          <p className="text-[var(--muted)]">
            Люди, аналитика и безопасность. Баннер, разделы, график и «В мире» — в разделе «Витрина».
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((item) => (
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
