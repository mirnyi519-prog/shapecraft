"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";
import { formatHoldPhone } from "@/lib/product-holds";
import {
  PRINT_REQUEST_STATUSES,
  PRINT_REQUEST_STATUS_LABELS,
  type PrintRequestStatus,
} from "@/lib/print-request";

export type PrintRequestRow = {
  id: string;
  source: string;
  title: string;
  priceLabel: string | null;
  sourceUrl: string | null;
  customerName: string;
  phone: string;
  quantity: number;
  status: PrintRequestStatus;
  createdAt: string;
};

export function PrintRequestList({ initial }: { initial: PrintRequestRow[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState("");

  async function setStatus(id: string, status: PrintRequestStatus) {
    const previous = rows;
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, status } : row)),
    );
    setError("");
    const response = await fetch(`/api/print-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setRows(previous);
      setError("Не удалось сменить статус");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-[var(--border)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
        Заявок на печать пока нет.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{row.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {row.source === "world" ? "В мире" : "Витрина"}
                {row.priceLabel ? ` · ${row.priceLabel}` : ""}
                {" · "}
                {row.quantity} шт
              </p>
            </div>
            <Badge
              tone={
                row.status === "ready"
                  ? "success"
                  : row.status === "new"
                    ? "warning"
                    : "neutral"
              }
            >
              {PRINT_REQUEST_STATUS_LABELS[row.status]}
            </Badge>
          </div>
          <p className="mt-3 text-sm">
            {row.customerName}
            {" · "}
            <a className="text-[var(--brand)]" href={`tel:+${row.phone}`}>
              {formatHoldPhone(row.phone)}
            </a>
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatDateTime(row.createdAt)}
          </p>
          {row.source === "world" && row.sourceUrl ? (
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block break-all text-sm font-medium text-[var(--brand)] hover:underline"
            >
              Ссылка на модель
            </a>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Статус</span>
            <select
              value={row.status}
              onChange={(event) =>
                void setStatus(row.id, event.target.value as PrintRequestStatus)
              }
              className="min-h-10 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium"
            >
              {PRINT_REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PRINT_REQUEST_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </article>
      ))}
    </div>
  );
}
