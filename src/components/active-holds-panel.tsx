"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";

type HoldRow = {
  id: string;
  productName: string;
  phone: string;
  expiresAt: string;
};

export function ActiveHoldsPanel() {
  const [holds, setHolds] = useState<HoldRow[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/holds");
    const data = (await response.json().catch(() => null)) as {
      holds?: HoldRow[];
      error?: string;
    } | null;
    if (!response.ok) {
      setError(data?.error ?? "Не удалось загрузить брони");
      setHolds([]);
      return;
    }
    setError("");
    setHolds(data?.holds ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(id: string) {
    const response = await fetch(`/api/holds/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Не удалось снять бронь");
      return;
    }
    await load();
  }

  if (holds === null) {
    return null;
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Бронь на витрине</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Держим 1 шт два часа. После продажи со стойки бронь снимается сама.
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {holds.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Активных броней нет.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {holds.map((hold) => (
            <li
              key={hold.id}
              className="flex flex-col gap-2 rounded-xl bg-[var(--bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{hold.productName}</p>
                <p className="text-sm text-[var(--muted)]">
                  {hold.phone} · до {formatDateTime(hold.expiresAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 shrink-0"
                onClick={() => void cancel(hold.id)}
              >
                Снять
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
