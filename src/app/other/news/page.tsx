import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HuntingNewsActions, HuntingNewsBackfill, NoiseWordRemove } from "@/components/hunting-news-controls";
import { Badge, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import {
  huntingAdminId,
  INCIDENT_FILTERS,
  INCIDENT_SOURCE_LABELS,
  type IncidentFilter,
  listIncidents,
  listNoiseWords,
  RUBRICS,
  type RubricId,
  sourceStats,
} from "@/lib/hunting-incidents";
import { formatMoscow } from "@/lib/timezone";

const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  pending: { label: "ждёт решения", tone: "warning" },
  published: { label: "в чатах", tone: "success" },
  skipped: { label: "пропущено", tone: "neutral" },
  seen: { label: "до запуска бота", tone: "neutral" },
};

const STATS_DAYS = 90;

function when(date: Date): string {
  return formatMoscow(date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function href(status: IncidentFilter, rubric: RubricId | null): string {
  return `/other/news?status=${status}${rubric ? `&rubric=${rubric}` : ""}`;
}

function chip(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm ring-1 ring-[var(--border)] ${active ? "bg-[var(--brand)] text-white" : "bg-white"}`;
}

export default async function HuntingNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; rubric?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const filter: IncidentFilter = INCIDENT_FILTERS.find((item) => item.id === params.status)?.id ?? "pending";
  const rubric: RubricId | null = RUBRICS.find((item) => item.id === params.rubric)?.id ?? null;
  const [{ items, counts, rubricCounts }, stats, noiseWords] = await Promise.all([
    listIncidents(filter, rubric),
    sourceStats(STATS_DAYS),
    listNoiseWords(),
  ]);
  const local = INCIDENT_SOURCE_LABELS.filter((source) => !source.regional).map((source) => `«${source.label}»`);
  const regional = INCIDENT_SOURCE_LABELS.filter((source) => source.regional).map((source) => `«${source.label}»`);
  const added = noiseWords.filter((word) => word.action === "add");

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Иное</p>
          <h1 className="text-2xl font-bold">Новости · лес, звери и происшествия в Шатуре</h1>
          <p className="text-[var(--muted)]">
            Бот раз в час читает местные каналы Шатурского и Егорьевского округов ({local.join(", ")}), а также областные (
            {regional.join(", ")}) — из них берёт только новости, где названо место в округе, и предупреждения про лёд по
            всей области. Подходящая новость приходит модератору в личку бота — с рубрикой, местом и всеми фото из
            оригинала (альбом — до 10 фото). В чаты и подписчикам (/podpiska) уходит только после «В чаты». Здесь же — предупреждения охотников
            через /vnimanie.
          </p>
          <HuntingNewsBackfill adminConfigured={huntingAdminId() !== ""} />
          <div className="flex flex-wrap gap-2">
            {INCIDENT_FILTERS.map((item) => (
              <Link key={item.id} href={href(item.id, rubric)} className={chip(item.id === filter)}>
                {item.label} · {counts[item.id]}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={href(filter, null)} className={chip(rubric === null)}>
              Все рубрики
            </Link>
            {RUBRICS.filter((item) => rubricCounts[item.id] > 0 || item.id === rubric).map((item) => (
              <Link key={item.id} href={href(filter, item.id)} className={chip(item.id === rubric)}>
                {item.emoji} {item.label} · {rubricCounts[item.id]}
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
              const rubrics = item.rubricIds.map((id) => RUBRICS.find((entry) => entry.id === id)!);
              return (
                <Card key={item.id}>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {item.photoCount > 0 ? (
                      <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:w-44">
                        {Array.from({ length: item.photoCount }, (_, index) => (
                          <a
                            key={index}
                            href={`/api/hunting/incidents/${item.id}/photo?i=${index}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={index === 0 ? "col-span-3" : undefined}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/hunting/incidents/${item.id}/photo?i=${index}`}
                              alt=""
                              loading="lazy"
                              className={`w-full bg-[var(--brand-soft)] object-cover ${index === 0 ? "h-40 rounded-xl sm:h-32" : "h-12 rounded-lg"}`}
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-semibold">{item.sourceLabel}</span>
                          <span className="text-[var(--muted)]"> · {when(item.publishedAt)}</span>
                          {item.place ? <span className="text-[var(--muted)]"> · 📍 {item.place}</span> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.duplicateOf ? <Badge tone="neutral">повтор</Badge> : null}
                          {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                        </div>
                      </div>
                      {rubrics.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {rubrics.map((entry) => (
                            <span key={entry.id} className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5">
                              {entry.emoji} {entry.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="line-clamp-6 whitespace-pre-line text-sm">{item.text}</p>
                      {item.also.length > 0 ? (
                        <p className="text-xs text-[var(--muted)]">
                          Также писали:{" "}
                          {item.also.map((entry, index) => (
                            <span key={entry.url}>
                              {index > 0 ? ", " : ""}
                              <a href={entry.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {entry.sourceLabel}
                              </a>
                            </span>
                          ))}
                        </p>
                      ) : null}
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

        <Card>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Качество источников за {STATS_DAYS} дней</h2>
            <p className="text-sm text-[var(--muted)]">
              «На проверку» — новости, которые бот прислал модератору (без повторов). Если у канала много пропущенных и
              нет отправленных — он только шумит.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[var(--muted)]">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Канал</th>
                    <th className="py-1 pr-3 text-right font-medium">На проверку</th>
                    <th className="py-1 pr-3 text-right font-medium">В чатах</th>
                    <th className="py-1 pr-3 text-right font-medium">Пропущено</th>
                    <th className="py-1 pr-3 text-right font-medium">Повторы</th>
                    <th className="py-1 font-medium">Последняя новость</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((row) => (
                    <tr key={row.label} className="border-t border-[var(--border)]">
                      <td className="py-1.5 pr-3">
                        {row.label}
                        {row.regional ? <span className="text-[var(--muted)]"> · областной</span> : null}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{row.shown}</td>
                      <td className="py-1.5 pr-3 text-right">{row.published}</td>
                      <td className="py-1.5 pr-3 text-right">{row.skipped}</td>
                      <td className="py-1.5 pr-3 text-right">{row.duplicates}</td>
                      <td className="py-1.5 text-[var(--muted)]">{row.lastAt ? when(row.lastAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Слова-шум от модератора</h2>
            <p className="text-sm text-[var(--muted)]">
              Первого числа бот присылает в личку слова, которые встречались только в пропущенных новостях. Нажатое «В шум»
              попадает сюда: посты с таким словом больше не приходят.
            </p>
            {added.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-sm">
                {added.map((word) => (
                  <span key={word.stem} className="rounded-full px-3 py-1 ring-1 ring-[var(--border)]">
                    {word.sample || word.stem}
                    <NoiseWordRemove stem={word.stem} label={word.sample || word.stem} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Пока пусто.</p>
            )}
          </div>
        </Card>

        <p className="text-xs text-[var(--muted)]">
          Фильтр: происшествие (место — лес, болото, река, охота, грибники; событие — пропал, пожар, браконьеры, шипы,
          застряли…), дикие звери и птицы (лось, кабан, волк, медведь, утка, глухарь…), грибы и тихая охота, лёд на
          водоёмах. Отчёты, праздники, фамилии и «фигура медведя» отсекаются. Похожие новости из разных каналов в пределах
          недели считаются одной — повторы видны как «Также писали». Показаны последние 100.
        </p>
      </div>
    </AppShell>
  );
}
