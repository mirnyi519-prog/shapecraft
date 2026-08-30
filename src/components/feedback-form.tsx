"use client";

import { useState } from "react";
import { Button, Card, Input, Textarea } from "@/components/ui";

export function FeedbackForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

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

    setName("");
    setContact("");
    setMessage("");
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <Card title="Спасибо!">
        <p className="text-[var(--muted)]">
          Сообщение отправлено администратору. Ответим, если оставили контакт.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => setSent(false)}
        >
          Написать ещё
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Написать администратору">
      <p className="mb-4 text-sm text-[var(--muted)]">
        Вопрос по игрушке, заказу или предложение — напишите здесь.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <Textarea
          label="Сообщение"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Например: есть ли в наличии синий динозавр?"
          required
          minLength={3}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={loading} className="min-h-11">
          {loading ? "Отправка..." : "Отправить"}
        </Button>
      </form>
    </Card>
  );
}
