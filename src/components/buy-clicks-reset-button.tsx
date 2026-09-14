"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

export function BuyClicksResetButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function resetAll() {
    setError("");
    setDone("");
    const confirmed = window.confirm(
      "Сбросить всю историю кликов «Купить» и обнулить счётчики на товарах?\nЭто нельзя отменить.",
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/buy-clicks", { method: "DELETE" });
    const data = (await response.json()) as {
      ok?: boolean;
      deletedClicks?: number;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      setError(data.error ?? "Не удалось сбросить");
      return;
    }

    setDone(`Удалено кликов: ${data.deletedClicks ?? 0}`);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="min-h-11"
        disabled={pending}
        onClick={() => void resetAll()}
      >
        Сбросить историю «Купить»
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {done ? <p className="text-sm text-green-700">{done}</p> : null}
    </div>
  );
}
