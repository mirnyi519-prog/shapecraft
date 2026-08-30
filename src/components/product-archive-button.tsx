"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function ProductArchiveButton({
  productId,
  active,
  className = "",
}: {
  productId: string;
  active: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle() {
    const message = active
      ? "Убрать товар с витрины? Он исчезнет из каталога, продажи будут недоступны."
      : "Вернуть товар на витрину?";

    if (!confirm(message)) {
      return;
    }

    setLoading(true);
    setError("");

    const response = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сохранения");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={active ? "secondary" : "primary"}
        className="min-h-11 w-full"
        disabled={loading}
        onClick={() => void handleToggle()}
      >
        {loading
          ? "Сохранение..."
          : active
            ? "Убрать с витрины"
            : "Добавить на витрину"}
      </Button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
