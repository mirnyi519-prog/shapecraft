"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  VisitsChartPeriod,
  VisitsHourlySeries,
} from "@/lib/visit-chart";

const PERIODS: { id: VisitsChartPeriod; label: string }[] = [
  { id: "day", label: "30 дней" },
  { id: "week", label: "12 недель" },
  { id: "month", label: "12 мес." },
];

function formatPeakHour(hour: number | null): string {
  if (hour == null) {
    return "—";
  }
  return `${String(hour).padStart(2, "0")}:00–${String(hour).padStart(2, "0")}:59`;
}

export function VisitsHourlyChart({
  initialData,
}: {
  initialData: VisitsHourlySeries;
}) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState<VisitsChartPeriod>(initialData.period);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function selectPeriod(next: VisitsChartPeriod) {
    if (next === period || pending) {
      return;
    }

    setPeriod(next);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/stats/visits-hourly?period=${next}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error("load");
        }
        const json = (await response.json()) as VisitsHourlySeries;
        setData(json);
      } catch {
        setError("Не удалось загрузить график");
      }
    });
  }

  const geometry = useMemo(() => {
    const width = 640;
    const height = 240;
    const padL = 8;
    const padR = 8;
    const padT = 16;
    const padB = 36;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const maxVisits = Math.max(...data.points.map((point) => point.visits), 1);
    const slot = plotW / 24;
    const barW = Math.max(slot * 0.62, 4);

    const bars = data.points.map((point) => {
      const h = (point.visits / maxVisits) * plotH;
      const x = padL + point.hour * slot + (slot - barW) / 2;
      const y = padT + plotH - h;
      return { ...point, x, y, h, barW };
    });

    return { width, height, padT, padB, plotH, bars, slot };
  }, [data.points]);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Время входа</h2>
          <p className="text-sm text-[var(--muted)]">{data.label}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PERIODS.map((item) => {
            const active = period === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectPeriod(item.id)}
                disabled={pending}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-white"
                } disabled:opacity-60`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Визитов в окне</p>
          <p className="text-xl font-semibold">{data.totalVisits}</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Уникальных</p>
          <p className="text-xl font-semibold">{data.uniqueVisitors}</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Пиковый час</p>
          <p className="text-xl font-semibold">{formatPeakHour(data.peakHour)}</p>
          {data.peakHour != null ? (
            <p className="text-xs text-[var(--muted)]">{data.peakVisits} визитов</p>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {data.totalVisits === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          За выбранное окно визитов нет.
        </p>
      ) : (
        <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`}>
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-56 w-full sm:h-64"
            role="img"
            aria-label="График визитов по часам суток"
          >
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = geometry.padT + geometry.plotH * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={8}
                  x2={geometry.width - 8}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              );
            })}

            {geometry.bars.map((bar) => (
              <rect
                key={bar.hour}
                x={bar.x}
                y={bar.y}
                width={bar.barW}
                height={Math.max(bar.h, bar.visits > 0 ? 2 : 0)}
                rx="3"
                fill={
                  bar.hour === data.peakHour
                    ? "var(--brand)"
                    : "var(--brand-soft)"
                }
                stroke={
                  bar.hour === data.peakHour ? "var(--brand-dark)" : "transparent"
                }
                strokeWidth="1"
              >
                <title>
                  {bar.label}: {bar.visits} визитов, уникальных {bar.uniqueVisitors}
                </title>
              </rect>
            ))}

            {geometry.bars.map((bar) =>
              bar.hour % 3 === 0 ? (
                <text
                  key={`label-${bar.hour}`}
                  x={bar.x + bar.barW / 2}
                  y={geometry.height - 12}
                  textAnchor="middle"
                  className="fill-[var(--muted)] text-[10px]"
                >
                  {bar.hour}
                </text>
              ) : null,
            )}
          </svg>
          <p className="mt-1 text-center text-xs text-[var(--muted)]">
            Часы суток по Москве (0–23)
          </p>
        </div>
      )}
    </div>
  );
}
