import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { getBotUsageStats, USAGE_PERIODS } from "@/lib/hunting-usage";
import { formatMoscow } from "@/lib/timezone";

function when(date: Date): string {
  return formatMoscow(date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}

function Bars({ rows, max }: { rows: { key: string; label: string; count: number; users: number }[]; max: number }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Нет обращений за период.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="font-medium">{row.label}</span>
            <span className="whitespace-nowrap text-[var(--muted)]">
              {row.count} · {row.users} чел.
            </span>
          </div>
          <div className="mt-1 h-2 rounded bg-[var(--border)]">
            <div className="h-2 rounded bg-[var(--brand)]" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function BotStatsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const requested = Number((await searchParams).days);
  const days = USAGE_PERIODS.find((value) => value === requested) ?? 30;
  const stats = await getBotUsageStats(days);
  const timelineMax = Math.max(1, ...stats.timeline.map((day) => day.count));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Иное</p>
          <h1 className="text-2xl font-bold">Охотничий бот · аналитика</h1>
          <p className="text-[var(--muted)]">
            Кто пользуется ботом и о чём спрашивает: команды в группе и в личке, вопросы текстом, голоса в сборах.
            Сообщения в группе без команды бот не видит и не учитывает. Даты документов в журнал не попадают. Журнал
            хранится год.
          </p>
          <div className="flex flex-wrap gap-2">
            {USAGE_PERIODS.map((value) => (
              <Link
                key={value}
                href={`/other/bot-stats?days=${value}`}
                className={`rounded-full px-3 py-1 text-sm ring-1 ring-[var(--border)] ${
                  value === days ? "bg-[var(--brand)] text-white" : "bg-white"
                }`}
              >
                {value === 365 ? "год" : `${value} дн.`}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Обращений" value={stats.total} />
          <Stat label="Людей" value={stats.users.length} />
          <Stat label="В личке" value={stats.privateCount} />
          <Stat label="В группах" value={stats.total - stats.privateCount} />
        </div>

        <Card title={`По дням${days > 90 ? " — последние 90" : ""}`}>
          <div className="flex h-28 items-end gap-[2px]">
            {stats.timeline.map((day, index) => (
              <div
                key={index}
                title={`${day.label}: ${day.count}`}
                className="flex-1 rounded-t bg-[var(--brand)]"
                style={{ height: `${(day.count / timelineMax) * 100}%`, minHeight: day.count ? 3 : 1, opacity: day.count ? 1 : 0.2 }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{stats.timeline[0]?.label}</span>
            <span>{stats.timeline.at(-1)?.label}</span>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="О чём спрашивают — разделы">
            <Bars rows={stats.sections} max={stats.sections[0]?.count ?? 1} />
          </Card>
          <Card title="Топ тем">
            <Bars rows={stats.topics} max={stats.topics[0]?.count ?? 1} />
          </Card>
        </div>

        <Card title="Кто пользуется">
          {stats.users.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Нет обращений за период.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-[var(--border)] py-2 pr-3 font-semibold">Охотник</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Обращений</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Чаще всего</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Где</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Последний раз</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map((user) => (
                    <tr key={user.userId}>
                      <td className="border-b border-[var(--border)] py-2 pr-3">
                        <div className="font-medium">{user.name}</div>
                        {user.username && !user.name.startsWith("@") ? (
                          <div className="text-xs text-[var(--muted)]">@{user.username}</div>
                        ) : null}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">{user.count}</td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <Badge>{user.topSection}</Badge>
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">{user.where}</td>
                      <td className="border-b border-[var(--border)] px-3 py-2 whitespace-nowrap">{when(user.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {stats.chats.length > 0 ? (
          <Card title="Группы">
            <Bars rows={stats.chats} max={stats.chats[0].count} />
          </Card>
        ) : null}

        <Card title="Последние обращения">
          {stats.recent.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Нет обращений за период.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-[var(--border)] py-2 pr-3 font-semibold">Когда</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Кто</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Где</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Тема</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Запрос</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((event) => (
                    <tr key={event.id} className="align-top">
                      <td className="border-b border-[var(--border)] py-2 pr-3 whitespace-nowrap">{when(event.createdAt)}</td>
                      <td className="border-b border-[var(--border)] px-3 py-2">{event.name}</td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        {event.chatType === "private" ? "личка" : event.chatTitle || "группа"}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <div>{event.title}</div>
                        <div className="text-xs text-[var(--muted)]">{event.section}</div>
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2 text-[var(--muted)]">{event.text || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
