"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BUY_CLICK_OUTCOME_LABELS,
  BUY_CLICK_OUTCOMES,
} from "@/lib/buy-intent";

export function BuyClickOutcomeSelect({
  clickId,
  outcome,
}: {
  clickId: string;
  outcome: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(outcome ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function save(next: string) {
    setError("");
    setValue(next);
    const response = await fetch(`/api/buy-clicks/${clickId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: next === "" ? null : next }),
    });

    if (!response.ok) {
      setError("Не сохранилось");
      setValue(outcome ?? "");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="min-w-[9.5rem]">
      <select
        value={value}
        disabled={pending}
        onChange={(event) => {
          void save(event.target.value);
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-medium text-[var(--text)]"
        aria-label="Исход клика"
      >
        <option value="">Без исхода</option>
        {BUY_CLICK_OUTCOMES.map((item) => (
          <option key={item} value={item}>
            {BUY_CLICK_OUTCOME_LABELS[item]}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
