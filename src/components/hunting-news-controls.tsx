"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type BackfillResult = {
  checked: number;
  matched: number;
  sent: number;
  duplicates: number;
  alreadyDecided: number;
  errors: string[];
};

export function HuntingNewsBackfill({ adminConfigured }: { adminConfigured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(0);
  const [message, setMessage] = useState("");

  async function run(days: number) {
    setBusy(days);
    setMessage("");
    try {
      const response = await fetch("/api/hunting/incidents/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; result?: BackfillResult } | null;
      if (!response.ok || !data?.result) {
        setMessage(data?.error ?? "Проверка не удалась");
        return;
      }
      const { checked, matched, sent, duplicates, alreadyDecided, errors } = data.result;
      setMessage(
        [
          `постов: ${checked}`,
          `подошло: ${matched}`,
          `в личку: ${sent}`,
          duplicates ? `дублей: ${duplicates}` : null,
          alreadyDecided ? `уже решено: ${alreadyDecided}` : null,
          errors.length ? `ошибки: ${errors.join("; ")}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      router.refresh();
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setBusy(0);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {[7, 30].map((days) => (
        <Button
          key={days}
          variant={days === 30 ? "primary" : "secondary"}
          onClick={() => run(days)}
          disabled={busy !== 0 || !adminConfigured}
          title={adminConfigured ? undefined : "Задайте TELEGRAM_HUNTING_ADMIN_ID"}
        >
          {busy === days ? "Проверяю каналы…" : `Проверить за ${days} дн.`}
        </Button>
      ))}
      {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
    </div>
  );
}

export function HuntingNewsActions({ id, canSkip }: { id: string; canSkip: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function act(action: "publish" | "skip") {
    if (action === "publish" && !window.confirm("Отправить новость во все охотничьи чаты?")) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/hunting/incidents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      setMessage(data?.message ?? data?.error ?? "Не удалось");
      router.refresh();
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => act("publish")} disabled={busy} className="px-3 py-1.5">
        📢 В чаты
      </Button>
      {canSkip ? (
        <Button variant="secondary" onClick={() => act("skip")} disabled={busy} className="px-3 py-1.5">
          ⏭ Пропустить
        </Button>
      ) : null}
      {message ? <span className="text-xs text-[var(--muted)]">{message}</span> : null}
    </div>
  );
}
