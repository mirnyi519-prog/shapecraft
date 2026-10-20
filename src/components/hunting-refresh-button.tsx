"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function HuntingRefreshButton({ groupConfigured }: { groupConfigured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "refresh" | "post" | "connect">("");
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy("refresh");
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
      setBusy("");
    }
  }

  async function post() {
    setBusy("post");
    setMessage("");
    try {
      const response = await fetch("/api/hunting/post", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Сводка отправлена в группу" : (data?.error ?? "Не удалось отправить"));
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setBusy("");
    }
  }

  async function connect() {
    setBusy("connect");
    setMessage("");
    try {
      const response = await fetch("/api/hunting/connect", { method: "POST" });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        username?: string;
      } | null;
      setMessage(
        response.ok
          ? `Команды подключены${data?.username ? ` — проверьте /help у @${data.username}` : ""}`
          : (data?.error ?? "Не удалось подключить"),
      );
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={refresh} disabled={busy !== ""}>
        {busy === "refresh" ? "Проверяю mooir.ru…" : "Обновить"}
      </Button>
      <Button
        variant="secondary"
        onClick={post}
        disabled={busy !== "" || !groupConfigured}
        title={groupConfigured ? undefined : "Задайте TELEGRAM_HUNTING_BOT_TOKEN и TELEGRAM_HUNTING_CHAT_ID"}
      >
        {busy === "post" ? "Отправляю…" : "Сводку в группу"}
      </Button>
      <Button
        variant="secondary"
        onClick={connect}
        disabled={busy !== "" || !groupConfigured}
        title={groupConfigured ? "Повторно нажимать безопасно" : "Сначала задайте токен и группу бота"}
      >
        {busy === "connect" ? "Подключаю…" : "Подключить команды бота"}
      </Button>
      {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
    </div>
  );
}
