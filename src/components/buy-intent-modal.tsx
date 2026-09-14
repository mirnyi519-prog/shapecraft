"use client";

import { useEffect } from "react";
import { PickupInfo } from "@/components/pickup-info";
import { useScrollLock } from "@/hooks/use-scroll-lock";

export function BuyIntentModal({
  open,
  productName,
  onClose,
}: {
  open: boolean;
  productName?: string;
  onClose: () => void;
}) {
  useScrollLock(open);

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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-intent-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="buy-intent-title" className="text-xl font-bold">
              Купить
            </h2>
            {productName ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{productName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--bg)]"
          >
            Закрыть
          </button>
        </div>

        <PickupInfo compact productName={productName} />
      </div>
    </div>
  );
}
