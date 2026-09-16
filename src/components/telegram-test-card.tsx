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
        hint="Отдельный новый бот. Пока шлём в рабочую группу ShapeCraft; позже — в kupipro77 (после ОК админов)."
        setup={
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>
              В Telegram: <code>@BotFather</code> → /newbot → имя вроде{" "}
              <code>ShapeCraft Market</code>, username например{" "}
              <code>shapecraft_market_bot</code>.
            </li>
            <li>
              Скопировать токен →{" "}
              <code>TELEGRAM_MARKET_BOT_TOKEN</code> в{" "}
              <code>/opt/shapecraft/.env</code>.
            </li>
            <li>
              Добавить бота в рабочую группу (как участника). В группах с
              privacy mode бот видит только команды — для отправки сообщений
              достаточно быть в чате.
            </li>
            <li>
              Узнать chat id группы (например через{" "}
              <code>@userinfobot</code> / <code>@RawDataBot</code> в группе, или
              getUpdates после сообщения в группе). Обычно вида{" "}
              <code>-100…</code>.
            </li>
            <li>
              Прописать <code>TELEGRAM_MARKET_CHAT_ID</code>, пересоздать
              контейнер, нажать «Отправить тест» здесь.
            </li>
          </ol>
        }
      />
    </div>
  );
}
