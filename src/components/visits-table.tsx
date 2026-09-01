"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";
import type { IpVisitSummary } from "@/lib/visits";

type SortKey = "count" | "last" | "first";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "count", label: "По визитам" },
  { id: "last", label: "По последнему" },
  { id: "first", label: "По первому" },
];

function pathLabel(path: string): string {
  if (path === "/") {
    return "Витрина";
  }
  if (path === "/login") {
    return "Вход";
  }
  if (path === "/dashboard") {
    return "Сводка";
  }
  if (path === "/products") {
    return "Товары";
  }
  if (path.startsWith("/products/")) {
    return "Товар";
  }
  return path;
}

function visitorTypeLabel(isReturning: boolean): string {
  return isReturning ? "Повторный" : "Новый";
}

export function VisitsTable({ rows }: { rows: IpVisitSummary[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("count");
  const [expandedIp, setExpandedIp] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    let list = rows;

    if (normalized) {
      list = list.filter((row) => {
        const haystack = [
          row.ipAddress,
          row.device.summary,
          row.device.os,
          row.device.browser,
          row.device.deviceLabel,
          row.referrer.label,
          row.referrer.raw,
          row.utm,
          visitorTypeLabel(row.lastIsReturning),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      });
    }

    return [...list].sort((a, b) => {
      switch (sort) {
        case "last":
          return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
        case "first":
          return new Date(b.firstVisit).getTime() - new Date(a.firstVisit).getTime();
        default:
          return b.visitCount - a.visitCount;
      }
    });
  }, [rows, deferredQuery, sort]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Поиск</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="IP, устройство, источник, UTM, новый/повторный..."
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base outline-none ring-[var(--brand)] focus:ring-2"
            autoComplete="off"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SORT_OPTIONS.map((item) => {
            const active = sort === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSort(item.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-[var(--muted)]">
          Показано: {filtered.length} из {rows.length} IP
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)]">
            {rows.length === 0
              ? "Посещений пока нет. Данные появятся после первых заходов на сайт."
              : "По этому запросу ничего не найдено."}
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Устройство</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Источник</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">UTM</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Визитов</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Первый</th>
                  <th className="px-4 py-3 font-medium">Последний</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Страницы</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const expanded = expandedIp === row.ipAddress;
                  return (
                    <VisitsRow
                      key={row.ipAddress}
                      row={row}
                      expanded={expanded}
                      onToggle={() =>
                        setExpandedIp(expanded ? null : row.ipAddress)
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function VisitsRow({
  row,
  expanded,
  onToggle,
}: {
  row: IpVisitSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-b-0">
        <td className="px-4 py-3">
          <div className="font-mono text-sm">{row.ipAddress}</div>
          <p className="mt-1 text-xs text-[var(--muted)] md:hidden">
            {row.device.summary}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)] lg:hidden">
            {row.referrer.label}
            {row.utm ? ` · ${row.utm}` : ""}
          </p>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="space-y-1">
            <p className="font-medium">{row.device.deviceLabel}</p>
            <p className="text-xs text-[var(--muted)]">
              {row.device.os} · {row.device.browser}
            </p>
          </div>
        </td>
        <td className="hidden px-4 py-3 lg:table-cell">
          <div className="space-y-1">
            <p className="font-medium">{row.referrer.label}</p>
            {row.referrer.raw ? (
              <p
                className="line-clamp-1 text-xs text-[var(--muted)]"
                title={row.referrer.raw}
              >
                {row.referrer.raw}
              </p>
            ) : null}
          </div>
        </td>
        <td className="hidden px-4 py-3 xl:table-cell">
          {row.utm ? (
            <span className="text-xs">{row.utm}</span>
          ) : (
            <span className="text-xs text-[var(--muted)]">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge tone={row.lastIsReturning ? "neutral" : "success"}>
            {visitorTypeLabel(row.lastIsReturning)}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="space-y-1">
            <Badge tone={row.visitCount >= 10 ? "success" : "neutral"}>
              {row.visitCount}
            </Badge>
            {row.visitCount > 1 ? (
              <p className="text-[11px] text-[var(--muted)]">
                {row.newVisits} нов · {row.returningVisits} повт
              </p>
            ) : null}
          </div>
        </td>
        <td className="hidden px-4 py-3 text-[var(--muted)] sm:table-cell">
          {formatDateTime(row.firstVisit)}
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">
          {formatDateTime(row.lastVisit)}
        </td>
        <td className="hidden px-4 py-3 lg:table-cell">
          <div className="flex flex-wrap gap-1">
            {row.topPaths.slice(0, 3).map((item) => (
              <span
                key={`${row.ipAddress}-${item.path}`}
                className="rounded-full bg-[var(--bg)] px-2 py-1 text-xs"
                title={`${item.path} · ${item.count}`}
              >
                {pathLabel(item.path)} · {item.count}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            {expanded ? "Скрыть" : "Подробнее"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
          <td colSpan={10} className="px-4 py-4">
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Последние визиты с {row.ipAddress}
              </p>
              <p className="text-sm text-[var(--muted)]">
                Последнее устройство: {row.device.summary}
              </p>
              <p className="text-sm text-[var(--muted)]">
                Последний источник: {row.referrer.label}
                {row.utm ? ` · UTM: ${row.utm}` : ""}
              </p>
              <div className="space-y-2">
                {row.recentVisits.map((visit, index) => (
                  <div
                    key={`${visit.visitedAt}-${index}`}
                    className="flex flex-col gap-1 rounded-xl bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{pathLabel(visit.path)}</p>
                        <Badge tone={visit.isReturning ? "neutral" : "success"}>
                          {visitorTypeLabel(visit.isReturning)}
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        {visit.path}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {visit.device.summary}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {visit.referrer.label}
                        {visit.utm ? ` · UTM: ${visit.utm}` : ""}
                      </p>
                      {visit.userAgent ? (
                        <p
                          className="mt-1 line-clamp-2 font-mono text-[11px] text-[var(--muted)]"
                          title={visit.userAgent}
                        >
                          {visit.userAgent}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      {formatDateTime(visit.visitedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
