"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";
import type { IpVisitSummary } from "@/lib/visits";

type SortKey = "count" | "last" | "first";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "count", label: "По визитам" },
  { id: "last", label: "По последнему" },
  { id: "first", label: "По первому" },
];

const TH =
  "px-3 py-2 align-middle text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]";
const TD = "px-3 py-2 align-middle text-xs leading-snug text-[var(--text)]";

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
    return "Сувениры";
  }
  if (path.startsWith("/products/")) {
    return "Сувенир";
  }
  return path;
}

function visitorTypeLabel(isReturning: boolean): string {
  return isReturning ? "Повторный" : "Новый";
}

function CompactBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success";
}) {
  const styles = {
    neutral: "bg-[var(--bg)] text-[var(--text)]",
    success: "bg-green-100 text-green-800",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${styles[tone]}`}
    >
      {children}
    </span>
  );
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
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none ring-[var(--brand)] focus:ring-2"
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
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
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
        <p className="text-xs text-[var(--muted)]">
          Показано: {filtered.length} из {rows.length} IP
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            {rows.length === 0
              ? "Посещений пока нет. Данные появятся после первых заходов на сайт."
              : "По этому запросу ничего не найдено."}
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[9.5rem]" />
                <col className="hidden md:table-column w-[8.5rem]" />
                <col className="hidden lg:table-column w-[7.5rem]" />
                <col className="hidden xl:table-column w-[8rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="hidden sm:table-column w-[7.5rem]" />
                <col className="w-[7.5rem]" />
                <col className="hidden lg:table-column w-[9rem]" />
                <col className="w-[5.5rem]" />
              </colgroup>
              <thead className="border-b border-[var(--border)] bg-[var(--bg)]">
                <tr>
                  <th className={TH}>IP</th>
                  <th className={`${TH} hidden md:table-cell`}>Устройство</th>
                  <th className={`${TH} hidden lg:table-cell`}>Источник</th>
                  <th className={`${TH} hidden xl:table-cell`}>UTM</th>
                  <th className={`${TH} text-center`}>Тип</th>
                  <th className={`${TH} text-center`}>Визитов</th>
                  <th className={`${TH} hidden sm:table-cell`}>Первый</th>
                  <th className={TH}>Последний</th>
                  <th className={`${TH} hidden lg:table-cell`}>Страницы</th>
                  <th className={`${TH} text-right`} />
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
        <td className={TD}>
          <div className="truncate font-mono text-[11px]">{row.ipAddress}</div>
          <p className="mt-1 truncate text-[10px] text-[var(--muted)] md:hidden">
            {row.device.summary}
          </p>
          <p className="mt-1 truncate text-[10px] text-[var(--muted)] lg:hidden">
            {row.referrer.label}
            {row.utm ? ` · ${row.utm}` : ""}
          </p>
        </td>
        <td className={`${TD} hidden md:table-cell`}>
          <p className="truncate font-medium">{row.device.deviceLabel}</p>
          <p className="truncate text-[10px] text-[var(--muted)]">
            {row.device.os} · {row.device.browser}
          </p>
        </td>
        <td className={`${TD} hidden lg:table-cell`}>
          <p className="truncate font-medium">{row.referrer.label}</p>
          {row.referrer.raw ? (
            <p className="truncate text-[10px] text-[var(--muted)]" title={row.referrer.raw}>
              {row.referrer.raw}
            </p>
          ) : null}
        </td>
        <td className={`${TD} hidden xl:table-cell`}>
          {row.utm ? (
            <span className="block truncate text-[10px]">{row.utm}</span>
          ) : (
            <span className="text-[10px] text-[var(--muted)]">—</span>
          )}
        </td>
        <td className={`${TD} text-center`}>
          <CompactBadge tone={row.lastIsReturning ? "neutral" : "success"}>
            {visitorTypeLabel(row.lastIsReturning)}
          </CompactBadge>
        </td>
        <td className={`${TD} text-center tabular-nums`}>
          <CompactBadge tone={row.visitCount >= 10 ? "success" : "neutral"}>
            {row.visitCount}
          </CompactBadge>
          {row.visitCount > 1 ? (
            <p className="mt-1 text-[10px] leading-none text-[var(--muted)]">
              {row.newVisits}/{row.returningVisits}
            </p>
          ) : null}
        </td>
        <td className={`${TD} hidden whitespace-nowrap tabular-nums text-[10px] text-[var(--muted)] sm:table-cell`}>
          {formatDateTime(row.firstVisit)}
        </td>
        <td className={`${TD} whitespace-nowrap tabular-nums text-[10px] text-[var(--muted)]`}>
          {formatDateTime(row.lastVisit)}
        </td>
        <td className={`${TD} hidden lg:table-cell`}>
          <div className="flex flex-wrap gap-1">
            {row.topPaths.slice(0, 3).map((item) => (
              <span
                key={`${row.ipAddress}-${item.path}`}
                className="inline-flex max-w-full truncate rounded-full bg-[var(--bg)] px-2 py-0.5 text-[10px] leading-none"
                title={`${item.path} · ${item.count}`}
              >
                {pathLabel(item.path)} · {item.count}
              </span>
            ))}
          </div>
        </td>
        <td className={`${TD} text-right`}>
          <button
            type="button"
            onClick={onToggle}
            className="whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            {expanded ? "Скрыть" : "Ещё"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
          <td colSpan={10} className="px-3 py-3">
            <div className="space-y-2 text-xs">
              <p className="font-medium">
                Последние визиты · {row.ipAddress}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                {row.device.summary} · {row.referrer.label}
                {row.utm ? ` · ${row.utm}` : ""}
              </p>
              <div className="space-y-1.5">
                {row.recentVisits.map((visit, index) => (
                  <div
                    key={`${visit.visitedAt}-${index}`}
                    className="grid gap-2 rounded-xl bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{pathLabel(visit.path)}</p>
                        <CompactBadge tone={visit.isReturning ? "neutral" : "success"}>
                          {visitorTypeLabel(visit.isReturning)}
                        </CompactBadge>
                      </div>
                      <p className="truncate font-mono text-[10px] text-[var(--muted)]">
                        {visit.path}
                      </p>
                      <p className="truncate text-[10px] text-[var(--muted)]">
                        {visit.device.summary} · {visit.referrer.label}
                        {visit.utm ? ` · ${visit.utm}` : ""}
                      </p>
                    </div>
                    <div className="whitespace-nowrap tabular-nums text-[10px] text-[var(--muted)] sm:text-right">
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
