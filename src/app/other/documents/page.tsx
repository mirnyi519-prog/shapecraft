import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { shortDate } from "@/lib/hunting-format";
import {
  DOCUMENT_SCHEDULE,
  fillMissingDocumentNames,
  getDocumentRows,
  type DocumentRow,
} from "@/lib/hunting-documents";
import { ymdKey } from "@/lib/hunting-shared";
import { moscowYmd } from "@/lib/timezone";

function LeftBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge>истёк {-days} дн. назад</Badge>;
  }
  if (days === 0) {
    return <Badge tone="warning">последний день</Badge>;
  }
  return <Badge tone={days <= 30 ? "warning" : "success"}>{days} дн.</Badge>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  await fillMissingDocumentNames().catch((error) => console.error("hunting document names", error));
  const { year, month, day } = moscowYmd();
  const rows: DocumentRow[] = await getDocumentRows(ymdKey(year, month, day));
  const hunters = new Set(rows.map((row) => row.userId)).size;
  const soon = rows.filter((row) => row.daysLeft >= 0 && row.daysLeft <= 30).length;
  const expired = rows.filter((row) => row.daysLeft < 0).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Иное</p>
          <h1 className="text-2xl font-bold">Документы охотников · сроки</h1>
          <p className="text-[var(--muted)]">
            Сроки, которые охотники сами записали боту в личке командой /dokument: разрешение на оружие, медзаключение,
            путёвка, разрешение на добычу. Бот напоминает каждому в личку с 12:00; серии и номера документов не хранятся.
            Истёкшие записи пропадают через 30 дней.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Охотников" value={hunters} />
          <Stat label="Истекает в ближайшие 30 дней" value={soon} />
          <Stat label="Уже истекло" value={expired} />
        </div>

        <Card>
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Пока никто не записал документы. Охотник пишет боту в личку, например: /dokument роха 15.03.2027
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-[var(--border)] py-2 pr-3 font-semibold">Охотник</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Документ</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Действует до</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Осталось</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Следующее напоминание</th>
                    <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="border-b border-[var(--border)] py-3 pr-3 font-medium">
                        {row.name || <span className="text-[var(--muted)]">имя скрыто в Telegram</span>}
                        <div className="text-xs font-normal text-[var(--muted)]">id {row.userId}</div>
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3">
                        <div>{row.kindTitle}</div>
                        {row.label ? <div className="text-xs text-[var(--muted)]">{row.label}</div> : null}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3 whitespace-nowrap">
                        {shortDate(row.expires, true)}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3">
                        <LeftBadge days={row.daysLeft} />
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3">
                        {row.nextReminder ? (
                          <>
                            <div className="whitespace-nowrap">{shortDate(row.nextReminder.date, true)}</div>
                            <div className="text-xs text-[var(--muted)]">{row.nextReminder.label}</div>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3">
                        {row.active ? (
                          <Badge tone="success">напоминания идут</Badge>
                        ) : (
                          <Badge>бот заблокирован</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Когда бот напоминает">
          <ul className="space-y-1 text-sm">
            {DOCUMENT_SCHEDULE.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span> — {item.remind}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Если документ записан, когда часть сроков уже прошла, запоздалых напоминаний не будет — придёт ближайшее
            следующее. Заблокировал бота — напоминания на паузе до следующего сообщения боту.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
