"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function LawsRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/hunting/laws", { method: "POST" });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        result?: { changed: string[]; errors: string[] };
      } | null;
      if (!response.ok || !data?.result) {
        setMessage(data?.error ?? "Сверка не удалась");
        return;
      }
      const { changed, errors } = data.result;
      const parts = [
        changed.length ? `изменилось: ${changed.join(", ")}` : null,
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
        {busy ? "Сверяю с КонсультантПлюс…" : "Проверить изменения"}
      </Button>
      {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
    </div>
  );
}
