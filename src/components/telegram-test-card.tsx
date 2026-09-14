"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

type Status = {
  configured: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  tokenTail: string | null;
  chatId: string | null;
};

export function TelegramTestCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/telegram/test");
      const data = (await response.json()) as Status & { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Не удалось проверить настройки");
        return;
      }
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/telegram/test", { method: "POST" });
      const data = (await response.json()) as {
        ok?: boolean;
        configured?: boolean;
        error?: string;
      };
      if (data.ok) {
        setMessage("Тестовое сообщение отправлено — проверьте Telegram.");
      } else {
        setMessage(data.error ?? "Отправка не удалась");
      }
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Telegram — клики «Купить»">
      <p className="mb-4 text-sm text-[var(--muted)]">
        Нужны <code>TELEGRAM_BOT_TOKEN</code> и <code>TELEGRAM_CHAT_ID</code> в
        <code> /opt/shapecraft/.env</code>, затем пересоздать контейнер.
      </p>
      {status ? (
        <ul className="mb-4 space-y-1 text-sm">
          <li>
            Настроено:{" "}
            <strong>{status.configured ? "да" : "нет"}</strong>
          </li>
          <li>Токен: {status.hasToken ? status.tokenTail : "нет"}</li>
          <li>Chat ID: {status.hasChatId ? status.chatId : "нет"}</li>
        </ul>
      ) : null}
      {message ? (
        <p
          className={`mb-4 text-sm ${
            message.includes("отправлено") ? "text-green-700" : "text-red-700"
          }`}
        >
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={loading}
          onClick={() => void loadStatus()}
        >
          Проверить env
        </Button>
        <Button
          type="button"
          className="min-h-11"
          disabled={loading}
          onClick={() => void sendTest()}
        >
          Отправить тест
        </Button>
      </div>
    </Card>
  );
}
