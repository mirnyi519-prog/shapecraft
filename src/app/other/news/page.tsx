import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HuntingNewsActions, HuntingNewsBackfill } from "@/components/hunting-news-controls";
import { Badge, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { huntingAdminId, INCIDENT_FILTERS, type IncidentFilter, listIncidents } from "@/lib/hunting-incidents";
import { formatMoscow } from "@/lib/timezone";

const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  pending: { label: "ждёт решения", tone: "warning" },
  published: { label: "в чатах", tone: "success" },
  skipped: { label: "пропущено", tone: "neutral" },
  seen: { label: "до запуска бота", tone: "neutral" },
};

function when(date: Date): string {
  return formatMoscow(date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function HuntingNewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const requested = (await searchParams).status;
  const filter: IncidentFilter = INCIDENT_FILTERS.find((item) => item.id === requested)?.id ?? "pending";
  const { items, counts } = await listIncidents(filter);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Иное</p>
          <h1 className="text-2xl font-bold">Новости · происшествия в Шатуре</h1>
          <p className="text-[var(--muted)]">
            Бот раз в час читает местные каналы («Шатура без цензуры», «Подслушано Шатура», «Подслушано у водителей»,
            «Ленинская Шатура») и ленту REGIONS · Шатура. Новость про лес, воду или охоту, где что-то случилось
            (пропал человек, пожар, медведь, шипы на дороге…), приходит модератору в личку бота — с фото, если оно есть в
            оригинале. В чаты уходит только после «В чаты». Здесь же — предупреждения охотников через /vnimanie.
          </p>
          <HuntingNewsBackfill adminConfigured={huntingAdminId() !== ""} />
          <div className="flex flex-wrap gap-2">
            {INCIDENT_FILTERS.map((item) => (
              <Link
                key={item.id}
                href={`/other/news?status=${item.id}`}
                className={`rounded-full px-3 py-1 text-sm ring-1 ring-[var(--border)] ${
                  item.id === filter ? "bg-[var(--brand)] text-white" : "bg-white"
                }`}
              >
                {item.label} · {counts[item.id]}
              </Link>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <p className="text-[var(--muted)]">
              {filter === "pending" ? "Новостей, ждущих решения, нет." : "Здесь пока пусто."}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const status = item.source === "hunter" ? { label: "от охотника", tone: "success" as const } : STATUS[item.status];
              const external = item.url.startsWith("http");
              return (
                <Card key={item.id}>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {item.photoUrl ? (
                      <a href={external ? item.url : undefined} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.photoUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-40 w-full rounded-xl object-cover sm:h-32 sm:w-44"
                        />
                      </a>
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-semibold">{item.sourceLabel}</span>
                          <span className="text-[var(--muted)]"> · {when(item.publishedAt)}</span>
                          {item.photoFileId && !item.photoUrl ? <span className="text-[var(--muted)]"> · с фото</span> : null}
                        </div>
                        {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                      </div>
                      <p className="line-clamp-6 whitespace-pre-line text-sm">{item.text}</p>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {external ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[var(--brand)] hover:underline"
                          >
                            Оригинал
                          </a>
                        ) : (
                          <span />
                        )}
                        {item.source !== "hunter" && item.status !== "published" ? (
                          <HuntingNewsActions id={item.id} canSkip={item.status === "pending"} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-[var(--muted)]">
          Фильтр: в тексте должно быть и место (лес, болото, торфяники, река, озеро, карьер, охота, рыбалка, грибники,
          угодья), и событие (спасли, пропал, утонул, пожар, браконьеры, выстрел, ранен, медведь, шипы, проколы, кража,
          застряли…). Похожие новости из разных каналов в пределах недели считаются одной. Показаны последние 100.
        </p>
      </div>
    </AppShell>
  );
}
