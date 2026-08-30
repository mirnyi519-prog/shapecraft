import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { VisitsTable } from "@/components/visits-table";
import { Button, StatCard } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { getVisitStats } from "@/lib/visits";

export default async function VisitsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const stats = await getVisitStats();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Посещения сайта</h1>
            <p className="text-[var(--muted)]">
              Счётчик просмотров страниц. Боты не учитываются.
            </p>
          </div>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="min-h-11 w-full sm:w-auto">
              К сводке
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Всего визитов" value={String(stats.totalVisits)} />
          <StatCard label="Уникальных IP" value={String(stats.uniqueIps)} />
          <StatCard
            label="Сегодня"
            value={String(stats.visitsToday)}
            accent
          />
        </div>

        <VisitsTable rows={stats.byIp} />
      </div>
    </AppShell>
  );
}
