"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  openPriceListPdf,
  shareOrOpenPriceListPdf,
  type PricePdfProduct,
} from "@/lib/price-list-pdf";

export function PricePrintClient({
  products,
}: {
  products: PricePdfProduct[];
}) {
  const [busy, setBusy] = useState<"share" | "open" | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  async function handleShare() {
    setBusy("share");
    setError("");
    setHint("");
    try {
      const result = await shareOrOpenPriceListPdf(products);
      if (result === "opened") {
        setHint(
          "PDF открыт. Нажмите «Поделиться» в просмотрщике и выберите «Печать».",
        );
      }
    } catch {
      setError("Не удалось создать PDF. Попробуйте «Открыть PDF».");
    } finally {
      setBusy(null);
    }
  }

  async function handleOpenPdf() {
    setBusy("open");
    setError("");
    setHint("");
    try {
      await openPriceListPdf(products);
      setHint(
        "Если PDF открылся — через «Поделиться» / меню выберите «Печать».",
      );
    } catch {
      setError("Не удалось открыть PDF. Обновите страницу и попробуйте снова.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="min-h-12 w-full text-base sm:w-auto"
          disabled={busy !== null || products.length === 0}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleOpenPdf();
          }}
        >
          {busy === "open" ? "Готовим PDF…" : "Открыть PDF"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 w-full text-base sm:w-auto"
          disabled={busy !== null || products.length === 0}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleShare();
          }}
        >
          {busy === "share" ? "Готовим…" : "Поделиться"}
        </Button>
      </div>
      {hint ? (
        <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--brand-dark)]">
          {hint}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
