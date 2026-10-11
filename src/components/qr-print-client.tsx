"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { renderSiteQrPng } from "@/lib/site-qr";
import { openSiteQrPdf, shareOrOpenSiteQrPdf } from "@/lib/site-qr-pdf";

export function QrPrintClient({ siteUrl }: { siteUrl: string }) {
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState<"share" | "open" | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const host = siteUrl.replace(/^https?:\/\//, "");

  useEffect(() => {
    let cancelled = false;
    void renderSiteQrPng(siteUrl)
      .then((src) => {
        if (!cancelled) setPreview(src);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось собрать QR-код.");
      });
    return () => {
      cancelled = true;
    };
  }, [siteUrl]);

  async function handleOpenPdf() {
    setBusy("open");
    setError("");
    setHint("");
    try {
      await openSiteQrPdf(siteUrl);
      setHint("Если PDF открылся — через «Поделиться» / меню выберите «Печать».");
    } catch {
      setError("Не удалось открыть PDF. Обновите страницу и попробуйте снова.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy("share");
    setError("");
    setHint("");
    try {
      const result = await shareOrOpenSiteQrPdf(siteUrl);
      if (result === "opened") {
        setHint("PDF открыт. Нажмите «Поделиться» в просмотрщике и выберите «Печать».");
      }
    } catch {
      setError("Не удалось создать PDF. Попробуйте «Открыть PDF».");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="min-h-12 w-full text-base sm:w-auto"
          disabled={busy !== null || !preview}
          onClick={() => void handleOpenPdf()}
        >
          {busy === "open" ? "Готовим PDF…" : "Открыть PDF"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 w-full text-base sm:w-auto"
          disabled={busy !== null || !preview}
          onClick={() => void handleShare()}
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

      <div className="mx-auto max-w-sm rounded-3xl bg-white px-6 py-8 text-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`QR-код ${host}`} className="mx-auto w-full" />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-[var(--bg)]" />
        )}
        <p className="mt-4 text-2xl font-bold tracking-tight">ShapeCraft</p>
        <p className="mt-1 text-lg text-[var(--muted)]">{host}</p>
      </div>
    </div>
  );
}
