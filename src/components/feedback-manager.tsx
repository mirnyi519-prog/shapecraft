"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";

export type FeedbackRow = {
  id: string;
  name: string | null;
  contact: string | null;
  message: string;
  ipAddress: string | null;
  read: boolean;
  createdAt: string;
  productId: string | null;
  productName: string | null;
};

type FilterChip = "all" | "new" | "read";

const CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "read", label: "Прочитанные" },
];

export function FeedbackManager({
  initialMessages,
  initialUnreadCount,
}: {
  initialMessages: FeedbackRow[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [chip, setChip] = useState<FilterChip>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return messages.filter((item) => {
      if (chip === "new" && item.read) {
        return false;
      }
      if (chip === "read" && !item.read) {
        return false;
      }
      if (!normalized) {
        return true;
      }

      const haystack = [
        item.name,
        item.contact,
        item.message,
        item.ipAddress,
        item.productName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [messages, chip, query]);

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

  async function removeItem(item: FeedbackRow) {
    if (!confirm("Удалить это сообщение?")) {
      return;
    }

    setBusyId(item.id);
    setError("");

    const response = await fetch(`/api/feedback/${item.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка удаления");
      setBusyId(null);
      return;
    }

    setMessages((current) => current.filter((row) => row.id !== item.id));
    if (!item.read) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          Всего: {messages.length}
          {unreadCount > 0 ? ` · новых: ${unreadCount}` : ""}
        </p>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busyId === "all"}
            onClick={() => void markAllRead()}
          >
            Отметить все прочитанными
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Поиск</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, контакт, текст, IP"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base outline-none ring-[var(--brand)] focus:ring-2"
            autoComplete="off"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHIPS.map((item) => {
            const active = chip === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setChip(item.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {filtered.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)]">
            {messages.length === 0
              ? "Сообщений пока нет. Форма на витрине внизу каталога."
              : "Ничего не найдено по фильтру."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-5 shadow-sm ${
                item.read
                  ? "border-[var(--border)] bg-white"
                  : "border-[var(--brand)] bg-[var(--brand-soft)]/35"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.read ? "neutral" : "warning"}>
                      {item.read ? "Прочитано" : "Новое"}
                    </Badge>
                    <span className="text-sm text-[var(--muted)]">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="font-medium">
                    {item.name?.trim() || "Без имени"}
                    {item.contact ? (
                      <span className="font-normal text-[var(--muted)]">
                        {" "}
                        · {item.contact}
                      </span>
                    ) : null}
                  </p>
                  {item.productName ? (
                    <p className="text-sm">
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
                  <p className="whitespace-pre-wrap text-[var(--text)]">
                    {item.message}
                  </p>
                  {item.ipAddress ? (
                    <p className="font-mono text-xs text-[var(--muted)]">
                      IP: {item.ipAddress}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyId === item.id}
                    onClick={() => void toggleRead(item)}
                  >
                    {item.read ? "Новое" : "Прочитано"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={busyId === item.id}
                    onClick={() => void removeItem(item)}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
