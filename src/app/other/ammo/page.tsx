import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import {
  AMMO_GENERAL,
  AMMO_SEASONS,
  AMMO_TABLE,
  SHOT_SIZES,
  seasonForMonth,
} from "@/lib/hunting-ammo";
import { moscowYmd } from "@/lib/timezone";

export default async function AmmoPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const currentSeason = seasonForMonth(moscowYmd().month);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Иное</p>
          <h1 className="text-2xl font-bold">Патроны · на кого и в какой сезон</h1>
          <p className="text-[var(--muted)]">
            Какой номер дроби, картечь или пулю брать на каждый вид — по сезонам. Охотничий бот берёт рекомендации из
            этой таблицы: в ответе на /utka, /kaban и другие виды в конце советует патрон на текущий сезон, а /patron
            показывает всю подборку.
          </p>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="w-44 border-b border-[var(--border)] py-2 pr-3 font-semibold">Вид</th>
                  {AMMO_SEASONS.map((season) => (
                    <th
                      key={season.id}
                      className={`border-b border-[var(--border)] px-3 py-2 font-semibold ${
                        season.id === currentSeason ? "bg-[var(--brand)]/10" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {season.title}
                        {season.id === currentSeason ? <Badge tone="warning">сейчас</Badge> : null}
                      </div>
                      <div className="text-xs font-normal text-[var(--muted)]">{season.months}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AMMO_TABLE.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td className="border-b border-[var(--border)] py-3 pr-3">
                      <div className="font-semibold">{row.title}</div>
                      <div className="text-xs text-[var(--muted)]">/{row.key}</div>
                      {row.rule ? <div className="mt-1 text-xs text-[var(--muted)]">⚠️ {row.rule}</div> : null}
                    </td>
                    {AMMO_SEASONS.map((season) => {
                      const tip = row.seasons[season.id];
                      return (
                        <td
                          key={season.id}
                          className={`border-b border-[var(--border)] px-3 py-3 ${
                            season.id === currentSeason ? "bg-[var(--brand)]/10" : ""
                          }`}
                        >
                          {tip ? (
                            <div className="space-y-1">
                              <div className="font-semibold">{tip.shot}</div>
                              {tip.mm || tip.load ? (
                                <div className="text-xs">
                                  {[tip.mm, tip.load ? `навеска ${tip.load}` : null].filter(Boolean).join(" · ")}
                                </div>
                              ) : null}
                              <div className="text-xs text-[var(--muted)]">{tip.note}</div>
                            </div>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Как пользоваться">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {AMMO_GENERAL.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>«—» — в этот сезон на вид обычно не охотятся. Открыт ли сезон в Шатуре — на вкладке «Охота · Шатура».</li>
            </ul>
          </Card>

          <Card title="Номера дроби">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {SHOT_SIZES.map((size) => (
                <div key={size.number} className="flex justify-between gap-2 border-b border-[var(--border)] py-1">
                  <span className="font-medium">{size.number}</span>
                  <span className="text-[var(--muted)]">{size.mm} мм</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
