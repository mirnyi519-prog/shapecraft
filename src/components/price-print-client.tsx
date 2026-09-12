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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleShare() {
    setBusy(true);
    setError("");
    try {
      await shareOrOpenPriceListPdf(products);
    } catch {
      setError("Не удалось создать PDF. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenPdf() {
    setBusy(true);
    setError("");
    try {
      await openPriceListPdf(products);
    } catch {
      setError("Не удалось открыть PDF. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy || products.length === 0}
          onClick={() => void handleShare()}
        >
          {busy ? "Готовим…" : "Поделиться PDF"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy || products.length === 0}
          onClick={() => void handleOpenPdf()}
        >
          Открыть PDF
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
