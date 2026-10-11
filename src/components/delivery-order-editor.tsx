"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { formatDateTime, formatRub } from "@/lib/calculations";
import {
  deliveryModeLabel,
  deliveryOrderStatusLabel,
  type DeliveryMode,
  type DeliveryOrderStatus,
} from "@/lib/delivery-order";
import { formatHoldPhone } from "@/lib/product-holds";

export type DeliveryOrderCardData = {
  id: string;
  number: string;
  status: DeliveryOrderStatus;
  deliveryMode: DeliveryMode;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  city: string;
  address: string;
  pvzCode: string;
  pvzAddress: string;
  comment: string;
  cdekNumber: string;
  goodsAmount: number;
  deliveryAmount: number;
  lines: { id: string; name: string; quantity: number; price: number }[];
  events: { id: string; status: string; note: string | null; createdAt: string }[];
};

export function DeliveryOrderEditor({ order }: { order: DeliveryOrderCardData }) {
  const router = useRouter();
  const [recipientName, setRecipientName] = useState(order.recipientName);
  const [recipientPhone, setRecipientPhone] = useState(formatHoldPhone(order.recipientPhone));
  const [recipientEmail, setRecipientEmail] = useState(order.recipientEmail);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(order.deliveryMode);
  const [city, setCity] = useState(order.city);
  const [address, setAddress] = useState(order.address);
  const [pvzCode, setPvzCode] = useState(order.pvzCode);
  const [pvzAddress, setPvzAddress] = useState(order.pvzAddress);
  const [comment, setComment] = useState(order.comment);
  const [cdekNumber, setCdekNumber] = useState(order.cdekNumber);
  const [deliveryAmount, setDeliveryAmount] = useState(String(order.deliveryAmount));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const locked = order.status === "handed_to_cdek" || order.status === "cancelled";

  function requestStatus(status: DeliveryOrderStatus) {
    if (status === "handed_to_cdek") {
      const lines = order.lines
        .map((line) => `${line.name} × ${line.quantity}`)
        .join(", ");
      const accepted = window.confirm(
        `Передать ${order.number} в СДЭК и списать склад?\n${lines || "Состав пуст"}`,
      );
      if (!accepted) return;
    }
    void save(status);
  }

  async function save(status?: DeliveryOrderStatus) {
    setLoading(status ?? "save");
    setError("");
    setMessage("");
    const response = await fetch(`/api/delivery-orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientName,
        recipientPhone,
        recipientEmail,
        deliveryMode,
        city,
        address,
        pvzCode,
        pvzAddress,
        comment,
        cdekNumber,
        deliveryAmount: Number(deliveryAmount.replace(",", ".")),
        status,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Не удалось сохранить");
      setLoading(null);
      return;
    }
    setMessage(status ? "Статус обновлён" : "Заказ сохранён");
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">
            <Link href="/delivery-orders" className="hover:text-[var(--brand)]">
              Заказы СДЭК
            </Link>
          </p>
          <h1 className="text-2xl font-bold">{order.number}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={order.status === "cancelled" ? "neutral" : "warning"}>
              {deliveryOrderStatusLabel(order.status)}
            </Badge>
            <span className="text-sm text-[#3d3d3e]">{deliveryModeLabel(order.deliveryMode)}</span>
          </div>
        </div>
        <Link
          href={`/delivery-orders/${order.id}/label?print=1`}
          aria-label="Печать адресного ярлыка"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"
        >
          <NavIcon name="print" className="h-5 w-5" />
          Ярлык
        </Link>
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Получатель и доставка</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Имя" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
          <Input label="Телефон" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} />
          <Input
            label="Почта"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium">Доставка</span>
            <select
              value={deliveryMode}
              onChange={(event) => setDeliveryMode(event.target.value as DeliveryMode)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base outline-none ring-[var(--brand)] focus:ring-2"
            >
              <option value="pvz">Пункт выдачи СДЭК</option>
              <option value="door">Курьер СДЭК</option>
            </select>
          </label>
          <Input label="Город" value={city} onChange={(event) => setCity(event.target.value)} />
          <div className="space-y-2">
            <Input
              label="Стоимость доставки, ₽"
              inputMode="decimal"
              value={deliveryAmount}
              onChange={(event) => setDeliveryAmount(event.target.value)}
            />
            <p className="text-sm text-[var(--muted)]">
              Для покупателя это тариф СДЭК плюс 10%. Пока калькулятора нет, сумму
              можно поправить вручную.
            </p>
          </div>
          <Input label="Адрес курьера" value={address} onChange={(event) => setAddress(event.target.value)} />
          <Input label="Код ПВЗ" value={pvzCode} onChange={(event) => setPvzCode(event.target.value)} />
          <Input label="Адрес ПВЗ" value={pvzAddress} onChange={(event) => setPvzAddress(event.target.value)} />
          <Input label="Трек СДЭК" value={cdekNumber} onChange={(event) => setCdekNumber(event.target.value)} />
        </div>
        <Textarea label="Комментарий" value={comment} onChange={(event) => setComment(event.target.value)} />
        <p className="text-sm text-[#3d3d3e]">
          Товары {formatRub(order.goodsAmount)} · вместе с доставкой{" "}
          {formatRub(order.goodsAmount + (Number(deliveryAmount.replace(",", ".")) || 0))}
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-[#3d3d3e]">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={loading !== null} onClick={() => void save()}>
            {loading === "save" ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
        {order.status === "awaiting_payment" || order.status === "paid" ? (
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-medium">Статус</p>
            <div className="flex flex-wrap gap-2">
              {order.status === "awaiting_payment" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading !== null}
                  onClick={() => requestStatus("paid")}
                >
                  {loading === "paid" ? "Проверяем остаток…" : "Оплачен"}
                </Button>
              ) : null}
              {order.status === "paid" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading !== null}
                  onClick={() => requestStatus("handed_to_cdek")}
                >
                  {loading === "handed_to_cdek" ? "Списываем…" : "Передан в СДЭК"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="danger"
                disabled={loading !== null}
                onClick={() => requestStatus("cancelled")}
              >
                {loading === "cancelled" ? "Отменяем…" : "Отменить"}
              </Button>
            </div>
          </div>
        ) : null}
        {locked ? (
          <p className="text-sm text-[#3d3d3e]">
            {order.status === "handed_to_cdek"
              ? "Склад уже списан. Поля можно поправить для ярлыка, остаток сам не вернётся."
              : "Заказ отменён. Поля можно поправить, на остаток это уже не влияет."}
          </p>
        ) : (
          <p className="text-sm text-[#3d3d3e]">
            «Оплачен» занимает свободный остаток. «Отменить» его возвращает. «Передан в СДЭК» списывает склад.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Состав</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span>
                {line.name} × {line.quantity}
              </span>
              <span>{formatRub(line.price * line.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">История</h2>
        <ul className="mt-3 space-y-2 text-sm text-[#3d3d3e]">
          {order.events.map((event) => (
            <li key={event.id}>
              {formatDateTime(event.createdAt)} · {deliveryOrderStatusLabel(event.status)}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
