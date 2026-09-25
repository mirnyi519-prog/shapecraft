"use client";

import { useEffect } from "react";
import { ModalCloseButton } from "@/components/modal-close-button";
import { PickupInfo } from "@/components/pickup-info";
import { useScrollLock } from "@/hooks/use-scroll-lock";

export function BuyIntentModal({
  open,
  productName,
  title = "Купить",
  onClose,
}: {
  open: boolean;
  productName?: string;
  title?: string;
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
          <PickupInfo compact showMap={false} productName={productName} />
        </div>
      </div>
    </div>
  );
}
