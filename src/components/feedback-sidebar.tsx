"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";
import { feedbackCardClass, type FeedbackRow } from "@/lib/feedback";

export function FeedbackSidebar({
  initialMessages,
  initialUnreadCount,
}: {
  initialMessages: FeedbackRow[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggleRead(item: FeedbackRow) {
    setBusyId(item.id);
    setError("");

    const response = await fetch(`/api/feedback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: !item.read }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка обновления");
      setBusyId(null);
      return;
    }

    setMessages((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, read: !row.read } : row,
      ),
    );
    setUnreadCount((current) => current + (item.read ? 1 : -1));
    setBusyId(null);
    router.refresh();
  }

  async function markAllRead() {
    setBusyId("all");
    setError("");

    const response = await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readAll: true }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка обновления");
      setBusyId(null);
      return;
    }

    setMessages((current) => current.map((row) => ({ ...row, read: true })));
    setUnreadCount(0);
    setBusyId(null);
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-20 hidden w-80 flex-col border-l border-[var(--border)] bg-white lg:flex">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Обратная связь</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {unreadCount > 0 ? `Новых: ${unreadCount}` : "Нет новых сообщений"}
            </p>
          </div>
          <Link
            href="/feedback"
            className="shrink-0 text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Все
          </Link>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-3 min-h-9 w-full text-sm"
            disabled={busyId === "all"}
            onClick={() => void markAllRead()}
          >
            Прочитать все
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {error ? <p className="mb-3 text-xs text-red-600">{error}</p> : null}

        {messages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--muted)]">
            Сообщений пока нет
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((item) => (
              <li key={item.id}>
                <article
                  className={`rounded-xl border p-3 ${feedbackCardClass(item.read)}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge tone={item.read ? "neutral" : "warning"}>
                      {item.read ? "Прочитано" : "Новое"}
                    </Badge>
                    <time className="text-xs text-[var(--muted)]">
                      {formatDateTime(item.createdAt)}
                    </time>
                  </div>

                  <p className="truncate text-sm font-medium">
                    {item.name?.trim() || "Без имени"}
                  </p>

                  {item.contact ? (
                    <p className="truncate text-xs text-[var(--muted)]">
                      {item.contact}
                    </p>
                  ) : null}

                  {item.productName ? (
                    <p className="mt-1 truncate text-xs">
                      <span className="text-[var(--muted)]">Товар: </span>
                      {item.productId ? (
                        <Link
                          href={`/products/${item.productId}`}
                          className="font-medium text-[var(--brand)] hover:underline"
                        >
                          {item.productName}
                        </Link>
                      ) : (
                        <span className="font-medium">{item.productName}</span>
                      )}
                    </p>
                  ) : null}

                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-[var(--text)]">
                    {item.message}
                  </p>

                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void toggleRead(item)}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                        item.read
                          ? "border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:bg-white"
                          : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                      }`}
                    >
                      {item.read ? "Отметить новым" : "Отметить прочитанным"}
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
