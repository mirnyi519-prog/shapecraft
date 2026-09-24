"use client";

import { useEffect, useState } from "react";
import type { PickupOpenStatus } from "@/lib/pickup-hours";

type PickupPublicResponse = {
  status: PickupOpenStatus;
  rows: { label: string; value: string }[];
};

export function PickupHoursPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<PickupPublicResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/pickup")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as PickupPublicResponse;
      })
      .then((payload) => {
        if (!cancelled && payload?.status && payload.rows) {
          setData(payload);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]"
            : "rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)]/50 px-4 py-4 text-sm text-[var(--muted)]"
        }
      >
        Загружаем часы работы…
      </div>
    );
  }

  const { status, rows } = data;

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
          {rows.map((row) => (
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
