"use client";

import { useMemo, useState, useTransition } from "react";
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

type Props = {
  initialData: SalesChartSeries;
  role: "admin" | "partner";
  selfShareLabel: string;
  otherShareLabel: string;
};

export function SalesChart({
  initialData,
  role,
  selfShareLabel,
  otherShareLabel,
}: Props) {
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

  const geometry = useMemo(() => {
    const width = 640;
    const height = 240;
    const padL = 12;
    const padR = 12;
    const padT = 16;
    const padB = 36;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const maxRevenue = Math.max(...data.points.map((point) => point.revenue), 1);
    const maxQuantity = Math.max(
      ...data.points.map((point) => point.quantity),
      1,
    );
    const count = Math.max(data.points.length - 1, 1);

    const coords = data.points.map((point, index) => {
      const x = padL + (plotW * index) / count;
      const yRevenue = padT + plotH - (point.revenue / maxRevenue) * plotH;
      const yQuantity = padT + plotH - (point.quantity / maxQuantity) * plotH;
      return { ...point, x, yRevenue, yQuantity };
    });

    const revenueLine = coords
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.yRevenue}`)
      .join(" ");
    const quantityLine = coords
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x} ${point.yQuantity}`,
      )
      .join(" ");
    const area =
      coords.length === 0
        ? ""
        : `${revenueLine} L ${coords[coords.length - 1].x} ${padT + plotH} L ${coords[0].x} ${padT + plotH} Z`;

    return {
      width,
      height,
      padT,
      padB,
      plotH,
      coords,
      revenueLine,
      quantityLine,
      area,
    };
  }, [data.points]);

  const selfShare = role === "admin" ? data.ownerShare : data.partnerShare;
  const otherShare = role === "admin" ? data.partnerShare : data.ownerShare;

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Дашборд продаж</h2>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Выручка</p>
          <p className="text-xl font-semibold">{formatRub(data.totalRevenue)}</p>
          <p className="text-xs text-[var(--muted)]">{data.saleCount} продаж</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Продано штук</p>
          <p className="text-xl font-semibold">{data.totalQuantity}</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">{selfShareLabel}</p>
          <p className="text-xl font-semibold">{formatRub(selfShare)}</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">{otherShareLabel}</p>
          <p className="text-xl font-semibold">{formatRub(otherShare)}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-[var(--text)]">
          <span className="h-0.5 w-5 rounded bg-[var(--brand)]" />
          Выручка
        </span>
        <span className="inline-flex items-center gap-2 text-[var(--muted)]">
          <span className="h-0.5 w-5 rounded border border-dashed border-[var(--muted)]" />
          Штуки
        </span>
      </div>

      {data.totalRevenue === 0 && data.totalQuantity === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          За выбранный период продаж нет.
        </p>
      ) : (
        <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`}>
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-64 w-full min-w-[28rem]"
            role="img"
            aria-label="Линейный график продаж за период"
          >
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = geometry.padT + geometry.plotH * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={12}
                  x2={geometry.width - 12}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              );
            })}

            <path d={geometry.area} fill="var(--brand)" opacity="0.12" />
            <path
              d={geometry.revenueLine}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={geometry.quantityLine}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.85"
            />

            {geometry.coords.map((point, index) => {
              const showLabel =
                geometry.coords.length <= 12 ||
                index % Math.ceil(geometry.coords.length / 8) === 0 ||
                index === geometry.coords.length - 1;

              return (
                <g key={point.key}>
                  <circle
                    cx={point.x}
                    cy={point.yRevenue}
                    r={point.revenue > 0 ? 3.5 : 2}
                    fill="var(--brand)"
                  >
                    <title>
                      {point.label}: {formatRub(point.revenue)}, {point.quantity}{" "}
                      шт
                    </title>
                  </circle>
                  {showLabel ? (
                    <text
                      x={point.x}
                      y={geometry.height - 12}
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
