"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input } from "@/components/ui";

export function OrdersSettingsEditor({
  initialEnabled,
  initialSellerName,
}: {
  initialEnabled: boolean;
  initialSellerName: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sellerName, setSellerName] = useState(initialSellerName);
  const [sellerMessage, setSellerMessage] = useState("");
  const [sellerError, setSellerError] = useState("");
  const [sellerLoading, setSellerLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(nextEnabled: boolean) {
    setLoading(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/settings/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось сохранить");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as { enabled?: boolean };
    setEnabled(Boolean(data.enabled));
    setMessage(data.enabled ? "Заказы включены" : "Заказы выключены");
    setLoading(false);
    router.refresh();
  }

  async function saveSeller() {
    setSellerLoading(true);
    setSellerError("");
    setSellerMessage("");
    const response = await fetch("/api/settings/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerName }),
    });
    const data = (await response.json()) as { error?: string; sellerName?: string };
    if (!response.ok) {
      setSellerError(data.error ?? "Не удалось сохранить");
      setSellerLoading(false);
      return;
    }
    setSellerName(data.sellerName ?? sellerName);
    setSellerMessage("Продавец сохранён. Он появится на следующих ярлыках.");
    setSellerLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
    <Card title="Доставка и регистрация">
      <div className="space-y-4">
        <Badge tone={enabled ? "success" : "neutral"}>
          {enabled ? "Включены" : "Выключены"}
        </Badge>
        <p className="text-sm leading-relaxed text-[var(--text)]">
          {enabled
            ? "Решение сохранено. Регистрация покупателя и заказ через СДЭК появятся на витрине только в этом режиме. Сами экраны ещё не выложены."
            : "На витрине нет регистрации и нет заказа с доставкой. Самовывоз и заявка на печать работают как раньше."}
        </p>
        <ul className="space-y-2 text-sm text-[#3d3d3e]">
          <li>Покупатель входит по телефону. Отдельный пароль не нужен.</li>
          <li>Доставка СДЭК: пункт выдачи или курьер. Оплата сразу, наложенного платежа нет.</li>
          <li>
            Стоимость доставки для покупателя — тариф СДЭК плюс 10% к этому тарифу.
            Калькулятора ещё нет, в карточке заказа сумма пока вводится вручную.
          </li>
          <li>
            Свободный остаток = склад минус бронь и минус оплаченные заказы. Отмена
            возвращает его. Передача в СДЭК списывает склад.
          </li>
          <li>Купить в пекарне и заявка на печать работают и при выключенных заказах.</li>
        </ul>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-[#3d3d3e]">{message}</p> : null}
        <Button
          type="button"
          variant={enabled ? "secondary" : "primary"}
          disabled={loading}
          onClick={() => void save(!enabled)}
        >
          {loading ? "Сохраняем…" : enabled ? "Выключить заказы" : "Включить заказы"}
        </Button>
      </div>
    </Card>
    <Card title="Продавец на ярлыке">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--text)]">
          Эта строка печатается на адресной этикетке 100×150. Отправитель на
          ярлыке всегда ShapeCraft.
        </p>
        <Input
          label="Продавец"
          value={sellerName}
          maxLength={80}
          onChange={(event) => setSellerName(event.target.value)}
          placeholder="Название, которое увидит получатель"
        />
        {sellerError ? <p className="text-sm text-red-600">{sellerError}</p> : null}
        {sellerMessage ? <p className="text-sm text-[#3d3d3e]">{sellerMessage}</p> : null}
        <Button
          type="button"
          disabled={sellerLoading}
          onClick={() => void saveSeller()}
        >
          {sellerLoading ? "Сохраняем…" : "Сохранить продавца"}
        </Button>
      </div>
    </Card>
    </div>
  );
}
