import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SecurityControls } from "@/components/security-controls";
import { Badge, Card, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";
import { getSession, isAdmin } from "@/lib/auth";
import { getSessionEpoch, listBlockedIps } from "@/lib/access-control";
import { prisma } from "@/lib/db";

const TYPE_LABELS: Record<string, string> = {
  login_fail: "Неверный вход",
  login_lock: "Блокировка входа",
  rate_limit: "Лимит запросов",
  probe: "Сканирование",
  upload_reject: "Отклонена загрузка",
  ip_block: "IP заблокирован",
  ip_unblock: "IP разблокирован",
  session_revoke: "Сброс сессий",
};

function typeTone(type: string): "warning" | "neutral" | "success" {
  if (
    type === "login_fail" ||
    type === "login_lock" ||
    type === "probe" ||
    type === "ip_block"
  ) {
    return "warning";
  }
  if (type === "session_revoke" || type === "ip_unblock") {
    return "success";
  }
  return "neutral";
}

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [events, total24h, loginFails24h, probes24h, locks24h, blocked, epoch] =
    await Promise.all([
      prisma.securityEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.securityEvent.count({
        where: { createdAt: { gte: since24h } },
      }),
      prisma.securityEvent.count({
        where: { type: "login_fail", createdAt: { gte: since24h } },
      }),
      prisma.securityEvent.count({
        where: { type: "probe", createdAt: { gte: since24h } },
      }),
      prisma.securityEvent.count({
        where: { type: "login_lock", createdAt: { gte: since24h } },
      }),
      listBlockedIps(),
      getSessionEpoch(),
    ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Безопасность</h1>
          <p className="text-[var(--muted)]">
            Сброс сессий, блоклист IP и журнал подозрительной активности.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Событий за 24 ч" value={String(total24h)} />
          <StatCard label="Неверных входов" value={String(loginFails24h)} />
          <StatCard label="Сканирований" value={String(probes24h)} accent />
          <StatCard label="Блокировок входа" value={String(locks24h)} />
        </div>

        <SecurityControls
          sessionEpoch={epoch}
          initialBlocked={blocked.map((row) => ({
            id: row.id,
            ipAddress: row.ipAddress,
            reason: row.reason,
            createdAt: row.createdAt.toISOString(),
            source: row.source,
          }))}
        />

        <Card title="Последние 100 событий">
          {events.length === 0 ? (
            <p className="text-[var(--muted)]">
              Пока тихо — события появятся при атаках и лишних попытках входа.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Время</th>
                      <th className="px-4 py-3 font-medium">Тип</th>
                      <th className="px-4 py-3 font-medium">IP</th>
                      <th className="px-4 py-3 font-medium">Путь / детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                          {formatDateTime(event.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={typeTone(event.type)}>
                            {TYPE_LABELS[event.type] ?? event.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {event.ipAddress}
                        </td>
                        <td className="px-4 py-3">
                          {event.path ? (
                            <p className="font-mono text-xs">{event.path}</p>
                          ) : null}
                          {event.detail ? (
                            <p className="mt-1 text-[var(--muted)]">{event.detail}</p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
