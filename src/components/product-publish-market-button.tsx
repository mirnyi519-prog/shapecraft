"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function ProductPublishMarketButton({
  productId,
  hasPrice,
  className = "",
}: {
  productId: string;
  hasPrice: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function handlePublish() {
    if (!hasPrice) {
      setOk(false);
      setMessage("Сначала задайте цену в прайсе");
      return;
    }

    if (
      !confirm(
        "Опубликовать объявление этого товара в рабочий Telegram-чат (маркет-бот)?",
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("");
    setOk(false);

    try {
      const response = await fetch(
        `/api/products/${productId}/publish-market`,
        { method: "POST" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setOk(false);
        setMessage(data.error ?? "Не удалось опубликовать");
        return;
      }

      setOk(true);
      setMessage("Отправлено в чат");
    } catch {
      setOk(false);
      setMessage("Сеть: не удалось вызвать API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 w-full"
        disabled={loading || !hasPrice}
        onClick={() => void handlePublish()}
        title={
          hasPrice
            ? "Отправить объявление маркет-ботом в рабочий чат"
            : "Нужна цена в прайсе"
        }
      >
        {loading ? "Отправка..." : "Опубликовать в чате"}
      </Button>
      {message ? (
        <p
          className={`mt-2 text-sm ${
            ok ? "text-green-700" : "text-red-600"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
