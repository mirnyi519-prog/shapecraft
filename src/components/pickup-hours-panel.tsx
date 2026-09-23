import {
  getPickupOpenStatus,
  PICKUP_HOURS_ROWS,
} from "@/lib/pickup-hours";

export function PickupHoursPanel({ compact = false }: { compact?: boolean }) {
  const status = getPickupOpenStatus();

  return (
    <div
      className={
        compact
          ? "space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
          : "space-y-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)]/50 px-4 py-4"
      }
    >
      <div>
        <p
          className={`font-semibold ${
            status.isOpenNow || status.canPickupToday
              ? "text-[var(--brand-dark)]"
              : "text-[var(--text)]"
          }`}
        >
          {status.headline}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{status.detail}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Часы работы
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {PICKUP_HOURS_ROWS.map((row) => (
            <li
              key={row.label}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="text-[var(--muted)]">{row.label}</span>
              <span
                className={
                  row.value === "выходной"
                    ? "text-[var(--muted)]"
                    : "font-medium text-[var(--text)]"
                }
              >
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
