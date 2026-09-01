"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Textarea } from "@/components/ui";
import { formatRub } from "@/lib/calculations";

type ChecklistKey =
  | "salesReviewed"
  | "stockReviewed"
  | "paymentSent"
  | "amountsConfirmed";

const CHECKLIST: {
  key: ChecklistKey;
  label: string;
  hint: (ctx: SettlementPanelProps) => string;
}[] = [
  {
    key: "salesReviewed",
    label: "Все продажи периода проверены",
    hint: (ctx) => `${ctx.pendingSalesCount} продаж в текущем периоде`,
  },
  {
    key: "stockReviewed",
    label: "Остатки на витрине сверены",
    hint: (ctx) =>
      ctx.zeroStockCount > 0
        ? `${ctx.zeroStockCount} товаров с нулевым остатком — проверьте витрину`
        : "Нет товаров с нулевым остатком",
  },
  {
    key: "paymentSent",
    label: "Доля партнёра передана или согласована",
    hint: (ctx) => `К выплате партнёру: ${formatRub(ctx.partnerShare)}`,
  },
  {
    key: "amountsConfirmed",
    label: "Суммы к расчёту согласованы",
    hint: (ctx) => `Выручка периода: ${formatRub(ctx.totalRevenue)}`,
  },
];

export type SettlementPanelProps = {
  pendingSalesCount: number;
  zeroStockCount: number;
  partnerShare: number;
  totalRevenue: number;
};

export function SettlementPanel({
  pendingSalesCount,
  zeroStockCount,
  partnerShare,
  totalRevenue,
}: SettlementPanelProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>({
    salesReviewed: false,
    stockReviewed: false,
    paymentSent: false,
    amountsConfirmed: false,
  });

  const ctx = { pendingSalesCount, zeroStockCount, partnerShare, totalRevenue };
  const allChecked = useMemo(
    () => Object.values(checks).every(Boolean),
    [checks],
  );

  function toggleCheck(key: ChecklistKey) {
    setChecks((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSettlement() {
    if (!allChecked) {
      setError("Отметьте все пункты чек-листа");
      return;
    }

    setLoading(true);
    setError("");

    const response = await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, checklistConfirmed: true }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка расчёта");
      setLoading(false);
      return;
    }

    setChecks({
      salesReviewed: false,
      stockReviewed: false,
      paymentSent: false,
      amountsConfirmed: false,
    });
    setNote("");
    setLoading(false);
    router.refresh();
  }

  if (pendingSalesCount === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Нет продаж в текущем периоде — расчёт пока не требуется.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Чек-лист перед расчётом</h3>
        <ul className="space-y-3">
          {CHECKLIST.map((item) => {
            const checked = checks[item.key];
            return (
              <li key={item.key}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheck(item.key)}
                    className="mt-1 h-4 w-4 rounded border-[var(--border)] text-[var(--brand)]"
                  />
                  <span>
                    <span
                      className={`block text-sm font-medium ${
                        checked ? "text-[var(--muted)] line-through" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {item.hint(ctx)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <Textarea
        label="Комментарий к расчёту"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Например: перевёл на карту, наличные в кассе"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button onClick={handleSettlement} disabled={loading || !allChecked}>
        {loading ? "Фиксируем..." : "Провести расчёт и обнулить период"}
      </Button>

      {!allChecked ? (
        <p className="text-xs text-[var(--muted)]">
          Отметьте все пункты чек-листа, чтобы провести расчёт.
        </p>
      ) : null}
    </div>
  );
}
