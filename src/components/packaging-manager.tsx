"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input } from "@/components/ui";
import {
  formatPackagingBoxSize,
  packagingRecommendHint,
  type PackagingCode,
  type PackagingOption,
} from "@/lib/packaging";

export function PackagingManager({ items }: { items: PackagingOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deltaById, setDeltaById] = useState<Record<string, string>>({});

  async function adjustStock(id: string, delta: number) {
    setBusyId(id);
    setError("");
    const response = await fetch(`/api/packaging/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockDelta: delta }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка обновления остатка");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    setDeltaById((prev) => ({ ...prev, [id]: "" }));
    router.refresh();
  }

  async function applyCustomDelta(id: string) {
    const raw = deltaById[id]?.trim() ?? "";
    const delta = Number(raw);
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
      setError("Укажите целое число со знаком, например 10 или -3");
      return;
    }
    await adjustStock(id, delta);
  }

  async function toggleActive(item: PackagingOption) {
    setBusyId(item.id);
    setError("");
    const response = await fetch(`/api/packaging/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card title="Как подбирается упаковка">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>
            <strong>mini</strong> — макс. габарит ≤ 60 мм (кликеры, брелоки)
          </li>
          <li>
            <strong>long</strong> — макс. габарит ≥ 300 мм (длинный шарнир)
          </li>
          <li>
            <strong>fragile</strong> — 90–160 мм и вес &lt; 55 г (ажур)
          </li>
          <li>
            <strong>standard</strong> — остальное и товары без габаритов
          </li>
        </ul>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const box = formatPackagingBoxSize(item);
          const hint = packagingRecommendHint(
            item.code as PackagingCode,
          );
          const low = item.stock <= 5;
          return (
            <Card
              key={item.id}
              title={item.name}
              className={!item.active ? "opacity-70" : ""}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{item.code}</Badge>
                <Badge tone={low ? "warning" : "success"}>
                  Остаток: {item.stock} шт
                </Badge>
                {!item.active ? <Badge tone="neutral">Выкл</Badge> : null}
                {item.productCount != null ? (
                  <span className="text-xs text-[var(--muted)]">
                    Товаров: {item.productCount}
                  </span>
                ) : null}
              </div>
              {box ? (
                <p className="text-sm text-[var(--muted)]">Короб: {box}</p>
              ) : null}
              {item.description ? (
                <p className="mt-1 text-sm text-[var(--text)]">{item.description}</p>
              ) : null}
              {hint ? (
                <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={busyId === item.id}
                  onClick={() => void adjustStock(item.id, 1)}
                >
                  +1
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={busyId === item.id || item.stock <= 0}
                  onClick={() => void adjustStock(item.id, -1)}
                >
                  −1
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={busyId === item.id}
                  onClick={() => void adjustStock(item.id, 10)}
                >
                  +10
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={busyId === item.id}
                  onClick={() => void toggleActive(item)}
                >
                  {item.active ? "Выключить" : "Включить"}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="w-28">
                  <Input
                    label="± шт"
                    value={deltaById[item.id] ?? ""}
                    onChange={(event) =>
                      setDeltaById((prev) => ({
                        ...prev,
                        [item.id]: event.target.value,
                      }))
                    }
                    placeholder="10"
                  />
                </div>
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={busyId === item.id}
                  onClick={() => void applyCustomDelta(item.id)}
                >
                  Применить
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {items.length === 0 ? (
        <Card title="Пусто">
          <p className="text-sm text-[var(--muted)]">
            Типы упаковки появятся после деплоя (seed). Перезапустите контейнер.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
