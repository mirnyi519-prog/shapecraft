"use client";

import { useEffect, useState } from "react";
import { ModalCloseButton } from "@/components/modal-close-button";
import { Button, Input, Textarea } from "@/components/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";

type FeedbackModalProps = {
  open: boolean;
  onClose: () => void;
  productId?: string;
  productName?: string;
};

export function FeedbackModal({
  open,
  onClose,
  productId,
  productName,
}: FeedbackModalProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

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

  useEffect(() => {
    if (!open) {
      setName("");
      setContact("");
      setMessage("");
      setWebsite("");
      setError("");
      setSent(false);
    }
  }, [open, productId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contact,
        message,
        productId,
        website,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось отправить");
      setLoading(false);
      return;
    }

    setName("");
    setContact("");
    setMessage("");
    setWebsite("");
    setSent(true);
    setLoading(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overscroll-none bg-black/50 p-3 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        className="flex max-h-[min(90vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-5">
          <h2 id="feedback-dialog-title" className="min-w-0 pr-2 text-xl font-semibold">
            {sent ? "Спасибо!" : "Обратная связь"}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
        {sent ? (
          <div className="space-y-4">
            <p className="text-[var(--muted)]">
              Сообщение отправлено администратору. Ответим, если оставили контакт.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                onClick={() => setSent(false)}
              >
                Написать ещё
              </Button>
              <Button type="button" className="min-h-11" onClick={onClose}>
                Готово
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              {productName ? (
                <p className="rounded-xl bg-[var(--brand-soft)] px-4 py-3 text-sm">
                  Вопрос по товару: <span className="font-medium">{productName}</span>
                </p>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Напишите нам прямо с витрины — сообщение попадёт администратору
                  ShapeCraft.
                </p>
              )}
            </div>
            {!productName ? (
              <div className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)]">
                <p className="font-medium">Когда это удобно:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
                  <li>узнать, есть ли нужный сувенир в пекарне сейчас;</li>
                  <li>спросить про цвет, размер или когда появится новая партия;</li>
                  <li>предложить идею для нового сувенира или пожелание;</li>
                  <li>сообщить об ошибке на сайте или в описании товара.</li>
                </ul>
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="relative space-y-4">
              <div
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
              >
                <label>
                  Сайт
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </label>
              </div>
              <Input
                label="Ваше имя"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Необязательно"
              />
              <Input
                label="Как связаться"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Телефон, Telegram, email"
              />
              <Textarea
                label="Сообщение"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  productName
                    ? `Например: когда будет «${productName}» в пекарне?`
                    : "Например: есть ли в наличии синий динозавр?"
                }
                required
                minLength={3}
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={loading} className="min-h-11 flex-1">
                  {loading ? "Отправка..." : "Отправить"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 flex-1"
                  onClick={onClose}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
