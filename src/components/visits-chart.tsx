"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  VisitsChartPeriod,
  VisitsChartSeries,
} from "@/lib/visit-chart";

const PERIODS: { id: VisitsChartPeriod; label: string }[] = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
];

export function VisitsChart({ initialData }: { initialData: VisitsChartSeries }) {
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
        const response = await fetch(`/api/stats/visits-chart?period=${next}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("load");
        }
        const json = (await response.json()) as VisitsChartSeries;
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
    const maxVisits = Math.max(...data.points.map((point) => point.visits), 1);
    const maxUnique = Math.max(
      ...data.points.map((point) => point.uniqueVisitors),
      1,
    );
    const count = Math.max(data.points.length - 1, 1);

    const coords = data.points.map((point, index) => {
      const x = padL + (plotW * index) / count;
      const yVisits = padT + plotH - (point.visits / maxVisits) * plotH;
      const yUnique = padT + plotH - (point.uniqueVisitors / maxUnique) * plotH;
      return { ...point, x, yVisits, yUnique };
    });

    const visitsLine = coords
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.yVisits}`)
      .join(" ");
    const uniqueLine = coords
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x} ${point.yUnique}`,
      )
      .join(" ");
    const area =
      coords.length === 0
        ? ""
        : `${visitsLine} L ${coords[coords.length - 1].x} ${padT + plotH} L ${coords[0].x} ${padT + plotH} Z`;

    const labelStep = Math.max(1, Math.ceil(coords.length / 8));

    return {
      width,
      height,
      padT,
      padB,
      plotH,
      coords,
      visitsLine,
      uniqueLine,
      area,
      labelStep,
    };
  }, [data.points]);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Посещаемость</h2>
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
          <p className="text-sm text-[var(--muted)]">Визитов</p>
          <p className="text-xl font-semibold">{data.totalVisits}</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Уникальных</p>
          <p className="text-xl font-semibold">{data.uniqueVisitors}</p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Пик за точку</p>
          <p className="text-xl font-semibold">{data.peakVisits}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-[var(--text)]">
          <span className="h-0.5 w-5 rounded bg-[var(--brand)]" />
          Визиты
        </span>
        <span className="inline-flex items-center gap-2 text-[var(--muted)]">
          <span className="h-0.5 w-5 rounded border border-dashed border-[var(--muted)]" />
          Уникальные
        </span>
      </div>

      {data.totalVisits === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          За выбранный период визитов нет.
        </p>
      ) : (
        <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`}>
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-56 w-full sm:h-64"
            role="img"
            aria-label="График посещаемости"
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
              d={geometry.visitsLine}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={geometry.uniqueLine}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.85"
            />

            {geometry.coords.map((point, index) =>
              index % geometry.labelStep === 0 ||
              index === geometry.coords.length - 1 ? (
                <text
                  key={point.key}
                  x={point.x}
                  y={geometry.height - 12}
                  textAnchor="middle"
                  className="fill-[var(--muted)] text-[10px]"
                >
                  {point.label}
                </text>
              ) : null,
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
