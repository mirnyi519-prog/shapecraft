"use client";

import { useState, useTransition } from "react";
import { formatRub } from "@/lib/calculations";
import type {
  SalesChartPeriod,
  SalesChartSeries,
} from "@/lib/sales-stats";

const PERIODS: { id: SalesChartPeriod; label: string }[] = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "year", label: "Год" },
];

function periodHint(period: SalesChartPeriod): string {
  switch (period) {
    case "day":
      return "Сегодня по часам";
    case "week":
      return "Последние 7 дней";
    case "month":
      return "Последние 30 дней";
    case "year":
      return "Последние 12 месяцев";
  }
}

export function SalesChart({
  initialData,
}: {
  initialData: SalesChartSeries;
}) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState<SalesChartPeriod>(initialData.period);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function selectPeriod(next: SalesChartPeriod) {
    if (next === period || pending) {
      return;
    }

    setPeriod(next);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/stats/sales-chart?period=${next}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("load");
        }
        const json = (await response.json()) as SalesChartSeries;
        setData(json);
      } catch {
        setError("Не удалось загрузить график");
      }
    });
  }

  const maxRevenue = Math.max(...data.points.map((point) => point.revenue), 1);
  const chartHeight = 220;
  const chartWidth = Math.max(data.points.length * 28, 480);
  const barGap = 6;
  const barWidth = Math.max(
    (chartWidth - barGap * (data.points.length + 1)) / data.points.length,
    8,
  );

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">График продаж</h2>
          <p className="text-sm text-[var(--muted)]">{periodHint(period)}</p>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Выручка</p>
          <p className="text-xl font-semibold">{formatRub(data.totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Продано штук</p>
          <p className="text-xl font-semibold">{data.totalQuantity}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {data.totalRevenue === 0 && data.totalQuantity === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          За выбранный период продаж нет.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight + 36}`}
            className={`h-64 w-full min-w-[28rem] ${pending ? "opacity-60" : ""}`}
            role="img"
            aria-label="График выручки по периодам"
          >
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = chartHeight - chartHeight * ratio + 8;
              return (
                <line
                  key={ratio}
                  x1={0}
                  x2={chartWidth}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              );
            })}
            {data.points.map((point, index) => {
              const height =
                point.revenue <= 0
                  ? 0
                  : Math.max((point.revenue / maxRevenue) * chartHeight, 3);
              const x = barGap + index * (barWidth + barGap);
              const y = chartHeight - height + 8;
              const showLabel =
                data.points.length <= 12 ||
                index % Math.ceil(data.points.length / 8) === 0 ||
                index === data.points.length - 1;

              return (
                <g key={point.key}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={4}
                    fill="var(--brand)"
                    opacity={point.revenue > 0 ? 0.95 : 0.2}
                  >
                    <title>
                      {point.label}: {formatRub(point.revenue)}, {point.quantity}{" "}
                      шт
                    </title>
                  </rect>
                  {showLabel ? (
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 28}
                      textAnchor="middle"
                      className="fill-[var(--muted)] text-[10px]"
                    >
                      {point.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
