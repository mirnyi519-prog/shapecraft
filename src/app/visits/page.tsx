import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { VisitsChart } from "@/components/visits-chart";
import { VisitsHourlyChart } from "@/components/visits-hourly-chart";
import { VisitsTable } from "@/components/visits-table";
import { Button, StatCard } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import {
  getVisitsChartSeries,
  getVisitsHourlySeries,
} from "@/lib/visit-chart";
import { getVisitStats } from "@/lib/visits";

export default async function VisitsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const [stats, chart, hourly] = await Promise.all([
    getVisitStats(),
    getVisitsChartSeries("day"),
    getVisitsHourlySeries("day"),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Посещения сайта</h1>
            <p className="text-[var(--muted)]">
              Витрина («/»), гости без входа. Повтор с того же IP/cookie не чаще
              раза в 30 мин (чтобы F5 не раздувал статистику). Админка, экран,
              логин и боты превью (TelegramBot) не считаются. Сортировка по
              умолчанию — свежие сверху.
            </p>
          </div>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="min-h-11 w-full sm:w-auto">
              К сводке
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Всего визитов" value={String(stats.totalVisits)} />
          <StatCard label="Уникальных IP" value={String(stats.uniqueIps)} />
          <StatCard
            label="Сегодня"
            value={String(stats.visitsToday)}
            accent
          />
          <StatCard
            label="Новые сегодня"
            value={String(stats.newVisitsToday)}
          />
          <StatCard
            label="Повторные сегодня"
            value={String(stats.returningVisitsToday)}
          />
        </div>

        <VisitsChart initialData={chart} />
        <VisitsHourlyChart initialData={hourly} />

        <VisitsTable rows={stats.byIp} />
      </div>
    </AppShell>
  );
}
