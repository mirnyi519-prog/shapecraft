import { ESTIMATE_SOURCE, factRange, factUrl, HISTORY_YEARS, SEASON_RULES } from "@/lib/hunting-history";

function dayMonth(key: string): string {
  return `${key.slice(8, 10)}.${key.slice(5, 7)}`;
}

function period(start: string, end: string): string {
  return `${dayMonth(start)}–${dayMonth(end)}`;
}

export function HuntingSeasonTable({ year }: { year: number }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-[var(--bg)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Что</th>
              <th className="px-3 py-2">Как обычно</th>
              <th className="whitespace-nowrap px-3 py-2 text-[var(--brand)]">{year} ≈</th>
              {[...HISTORY_YEARS].reverse().map((item) => (
                <th key={item} className="px-2 py-2 text-center">
                  {item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {SEASON_RULES.map((rule) => {
              const estimate = rule.estimate(year);
              return (
                <tr key={rule.id} className="align-top">
                  <td className="px-3 py-2 font-medium">
                    {rule.label}
                    {rule.note ? <p className="mt-1 text-xs font-normal text-[var(--muted)]">{rule.note}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">{rule.rule}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{period(estimate.start, estimate.end)}</td>
                  {[...HISTORY_YEARS].reverse().map((item) => {
                    const fact = rule.history[item];
                    if (fact === undefined) {
                      return (
                        <td key={item} className="px-2 py-2 text-center text-[var(--muted)]">
                          ?
                        </td>
                      );
                    }
                    if (fact === null) {
                      return (
                        <td key={item} className="px-2 py-2 text-center text-[var(--muted)]">
                          —
                        </td>
                      );
                    }
                    const range = factRange(item, fact);
                    return (
                      <td key={item} className="whitespace-nowrap px-2 py-2 text-center">
                        <a
                          href={factUrl(fact)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[var(--brand)] hover:underline"
                        >
                          {period(range.start, range.end)}
                        </a>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)]">
        {ESTIMATE_SOURCE} «—» — в Шатуре не открывали, «?» — распоряжения на mooir.ru нет. Даты прошлых лет — ссылки на
        распоряжения.
      </p>
    </div>
  );
}
