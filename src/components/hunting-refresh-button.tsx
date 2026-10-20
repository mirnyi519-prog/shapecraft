"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function HuntingRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/hunting/refresh", { method: "POST" });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        result?: { added: string[]; changed: string[]; errors: string[] };
      } | null;
      if (!response.ok || !data?.result) {
        setMessage(data?.error ?? "Обновление не удалось");
        return;
      }
      const { added, changed, errors } = data.result;
      const parts = [
        added.length ? `новых документов: ${added.length}` : null,
        changed.length ? `изменилось: ${changed.length}` : null,
        errors.length ? `не открылось: ${errors.length}` : null,
      ].filter(Boolean);
      setMessage(parts.length ? parts.join(" · ") : "Без изменений");
      router.refresh();
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={refresh} disabled={busy}>
        {busy ? "Проверяю mooir.ru…" : "Обновить"}
      </Button>
      {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
    </div>
  );
}
