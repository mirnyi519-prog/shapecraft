"use client";

import { useState, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";

type Channel = "ops" | "market";

type Status = {
  channel: Channel;
  label: string;
  configured: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  tokenTail: string | null;
  chatId: string | null;
};

type ChannelUi = {
  status: Status | null;
  message: string;
  messageOk: boolean;
  loading: boolean;
};

const EMPTY_UI: ChannelUi = {
  status: null,
  message: "",
  messageOk: false,
  loading: false,
};

function ChannelCard({
  channel,
  title,
  hint,
  setup,
}: {
  channel: Channel;
  title: string;
  hint: string;
  setup?: ReactNode;
}) {
  const [ui, setUi] = useState<ChannelUi>(EMPTY_UI);

  async function loadStatus(clearMessage = true) {
    setUi((prev) => ({
      ...prev,
      loading: true,
      message: clearMessage ? "" : prev.message,
    }));
    try {
      const response = await fetch(`/api/telegram/test?channel=${channel}`);
      const data = (await response.json()) as Status & { error?: string };
      if (!response.ok) {
        setUi((prev) => ({
          ...prev,
          messageOk: false,
          message: data.error ?? "Не удалось проверить настройки",
          loading: false,
        }));
        return;
      }
      setUi((prev) => ({
        ...prev,
        status: data,
        loading: false,
      }));
    } catch {
      setUi((prev) => ({
        ...prev,
        messageOk: false,
        message: "Сеть: не удалось вызвать /api/telegram/test",
        loading: false,
      }));
    }
  }

  async function sendTest() {
    setUi((prev) => ({ ...prev, loading: true, message: "" }));
    try {
      const response = await fetch(`/api/telegram/test?channel=${channel}`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        configured?: boolean;
        error?: string;
      };
      if (data.ok) {
        setUi((prev) => ({
          ...prev,
          messageOk: true,
          message: "Тестовое сообщение отправлено — проверьте Telegram.",
        }));
      } else {
        setUi((prev) => ({
          ...prev,
          messageOk: false,
          message: data.error ?? "Отправка не удалась",
        }));
      }
      await loadStatus(false);
    } catch {
      setUi((prev) => ({
        ...prev,
        messageOk: false,
        message: "Сеть: не удалось вызвать /api/telegram/test",
        loading: false,
      }));
    }
  }

  return (
    <Card title={title}>
      <p className="mb-4 text-sm text-[var(--muted)]">{hint}</p>
      {setup}
      {ui.status ? (
        <ul className="mb-4 space-y-1 text-sm">
          <li>
            Настроено:{" "}
            <strong>{ui.status.configured ? "да" : "нет"}</strong>
          </li>
          <li>Токен: {ui.status.hasToken ? ui.status.tokenTail : "нет"}</li>
          <li>Chat ID: {ui.status.hasChatId ? ui.status.chatId : "нет"}</li>
        </ul>
      ) : null}
      {ui.message ? (
        <p
          className={`mb-4 text-sm ${
            ui.messageOk ? "text-green-700" : "text-red-700"
          }`}
        >
          {ui.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={ui.loading}
          onClick={() => void loadStatus(true)}
        >
          Проверить env
        </Button>
        <Button
          type="button"
          className="min-h-11"
          disabled={ui.loading}
          onClick={() => void sendTest()}
        >
          Отправить тест
        </Button>
      </div>
    </Card>
  );
}

export function TelegramTestCard() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChannelCard
        channel="ops"
        title="Telegram — служебный"
        hint={
          "Клики «Купить», приход и продажа. Переменные TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в /opt/shapecraft/.env, затем пересоздать контейнер."
        }
      />
      <ChannelCard
        channel="market"
        title="Telegram — маркет / рабочая группа"
        hint="Отдельный бот ShapeCraft Market → группа kupipro77 (топик). Не чаще 1 объявления в час."
        setup={
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>
              Добавьте бота в{" "}
              <a
                href="https://t.me/kupipro77"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--brand)] underline-offset-2 hover:underline"
              >
                t.me/kupipro77
              </a>{" "}
              (права писать в нужный топик).
            </li>
            <li>
              В <code>/opt/shapecraft/.env</code>:
              <br />
              <code>TELEGRAM_MARKET_CHAT_ID=-1002313269004</code>
              <br />
              <code>TELEGRAM_MARKET_THREAD_ID=26</code>
              <br />
              (из ссылки{" "}
              <code>t.me/c/2313269004/26</code> — чат{" "}
              <code>-100…</code>, топик <code>26</code>).
            </li>
            <li>
              Пересоздать контейнер → «Отправить тест» здесь. Объявления с
              карточки товара — не чаще 1 раза в час.
            </li>
          </ol>
        }
      />
    </div>
  );
}
