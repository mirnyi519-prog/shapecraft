"use client";

import { useEffect, useState } from "react";
import { ModalCloseButton } from "@/components/modal-close-button";
import { PickupInfo } from "@/components/pickup-info";
import { Button, Input } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";

export function BuyIntentModal({
  open,
  productId,
  productName,
  canReserve = false,
  title = "Купить",
  onClose,
  onReserved,
}: {
  open: boolean;
  productId?: string;
  productName?: string;
  canReserve?: boolean;
  title?: string;
  onClose: () => void;
  onReserved?: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [until, setUntil] = useState("");
  const [heldQuantity, setHeldQuantity] = useState(1);
  const [plan, setPlan] = useState<{
    free: number;
    sameDay: boolean;
    pickupText: string;
  } | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) {
      setPhone("");
      setQuantity(1);
      setBusy(false);
      setError("");
      setUntil("");
      setPlan(null);
    }
  }, [open, productId]);

  useEffect(() => {
    if (!open || !productId || !canReserve) {
      return;
    }
    let cancelled = false;
    fetch(`/api/products/${productId}/hold`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.free === "number") {
          setPlan(data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, productId, canReserve]);

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

  async function reserve() {
    if (!productId) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${productId}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, quantity }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        until?: string;
        quantity?: number;
      } | null;
      if (!response.ok) {
        setError(data?.error ?? "Не удалось забронировать");
        return;
      }
      setHeldQuantity(data?.quantity ?? quantity);
      setUntil(data?.until ?? "");
      onReserved?.();
    } catch {
      setError("Не удалось забронировать");
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
        aria-labelledby="buy-intent-title"
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-5">
          <div className="min-w-0 pr-2">
            <h2 id="buy-intent-title" className="text-xl font-bold">
              {title}
            </h2>
            {productName ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{productName}</p>
            ) : null}
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
          {productId && canReserve && !until ? (
            <form
              className="space-y-3 rounded-xl border border-[var(--brand)]/40 bg-[var(--brand-soft)] px-4 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                void reserve();
              }}
            >
              <p className="text-sm font-semibold text-[var(--brand-dark)]">
                Забронировать
              </p>
              <p className="text-sm text-[var(--text)]">
                {plan
                  ? `${plan.pickupText} — до этого времени никому не отдадим.`
                  : "Держим, пока едете в пекарню."}{" "}
                Телефон нужен, чтобы не отдать другому.
              </p>
              {plan && plan.free > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Количество</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 min-w-11 px-0"
                      aria-label="Меньше"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    >
                      −
                    </Button>
                    <span className="min-w-8 text-center text-base font-semibold" aria-live="polite">
                      {quantity}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 min-w-11 px-0"
                      aria-label="Больше"
                      disabled={quantity >= plan.free}
                      onClick={() => setQuantity((value) => Math.min(plan.free, value + 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>
              ) : null}
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
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <Button type="submit" className="min-h-11 w-full" disabled={busy}>
                {busy ? "Бронируем…" : "Забронировать"}
              </Button>
            </form>
          ) : null}
          {until ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
              Держим {heldQuantity} шт до {until}. Заберите в пекарне «У Светланы».
            </div>
          ) : null}
          {!canReserve && productId && !until ? (
            <p className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
              Свободных штук сейчас нет. Можно уточнить по телефону — вдруг бронь
              освободится раньше.
            </p>
          ) : null}
          <PickupInfo compact showMap={false} productName={productName} />
        </div>
      </div>
    </div>
  );
}
