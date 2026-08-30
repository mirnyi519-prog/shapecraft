"use client";

import { useEffect, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";

export function FeedbackForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeModal() {
    setOpen(false);
    setError("");
  }

  function resetForm() {
    setName("");
    setContact("");
    setMessage("");
    setSent(false);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contact, message }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Не удалось отправить");
      setLoading(false);
      return;
    }

    resetForm();
    setSent(true);
    setLoading(false);
  }

  return (
    <>
      <div className="flex justify-center pt-2">
        <Button type="button" className="min-h-11 px-6" onClick={() => setOpen(true)}>
          Написать администратору
        </Button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          onClick={closeModal}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {sent ? (
              <div className="space-y-4">
                <h2 id="feedback-dialog-title" className="text-xl font-semibold">
                  Спасибо!
                </h2>
                <p className="text-[var(--muted)]">
                  Сообщение отправлено администратору. Ответим, если оставили контакт.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => {
                      setSent(false);
                    }}
                  >
                    Написать ещё
                  </Button>
                  <Button type="button" className="min-h-11" onClick={closeModal}>
                    Закрыть
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 id="feedback-dialog-title" className="text-xl font-semibold">
                    Написать администратору
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Вопрос по игрушке, заказу или предложение.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="Например: есть ли в наличии синий динозавр?"
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
                      onClick={closeModal}
                    >
                      Отмена
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
