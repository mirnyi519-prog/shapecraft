"use client";

import { useEffect, useState } from "react";
import { ModalCloseButton } from "@/components/modal-close-button";
import { Button, Input } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";

export function PrintOrderModal({
  open,
  source,
  title,
  priceNote,
  productId,
  sourceUrl,
  onClose,
}: {
  open: boolean;
  source: "catalog" | "world";
  title: string;
  priceNote: string | null;
  productId?: string;
  sourceUrl?: string | null;
  onClose: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useScrollLock(open);

  useEffect(() => {
    if (!open) {
      setCustomerName("");
      setPhone("");
      setQuantity("1");
      setBusy(false);
      setError("");
      setDone(false);
    }
  }, [open, title]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/print-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          title,
          priceNote,
          productId,
          sourceUrl,
          customerName,
          phone,
          quantity,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(data?.error ?? "Не удалось отправить заявку");
        return;
      }
      setDone(true);
    } catch {
      setError("Не удалось отправить заявку. Проверьте сеть.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="safe-overlay fixed inset-0 z-[60] flex items-end justify-center overscroll-none bg-black/50 p-3 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-order-title"
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-5">
          <div className="min-w-0 pr-2">
            <h2 id="print-order-title" className="text-xl font-bold">
              Заказать печать
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{title}</p>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
          {done ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
              Заявку приняли. Свяжемся по телефону, когда можно будет забрать в
              пекарне «У Светланы».
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <p className="text-sm text-[var(--text)]">
                {source === "world"
                  ? "Модели нет на складе — напечатаем под заказ и отложим в пекарне."
                  : "Свободных штук сейчас нет. Напечатаем и отложим в пекарне."}
                {priceNote ? ` Цена: ${priceNote}.` : " Цену скажем по телефону."}
              </p>
              <Input
                label="Имя"
                name="name"
                autoComplete="name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
              />
              <Input
                label="Телефон"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 900 000-00-00"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
              <Input
                label="Количество"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <Button type="submit" className="min-h-11 w-full" disabled={busy}>
                {busy ? "Отправляем…" : "Отправить заявку"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
