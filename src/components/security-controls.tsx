"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { formatDateTime } from "@/lib/calculations";

type BlockedRow = {
  id: string;
  ipAddress: string;
  reason: string | null;
  createdAt: string;
  source: "db" | "static";
};

export function SecurityControls({
  initialBlocked,
  sessionEpoch,
}: {
  initialBlocked: BlockedRow[];
  sessionEpoch: number;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(sessionEpoch);

  async function revokeSessions() {
    if (
      !confirm(
        "Сбросить все сессии? Всем пользователям нужно будет войти заново.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/security/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_sessions" }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сброса сессий");
      setBusy(false);
      return;
    }
    const data = (await response.json()) as { sessionEpoch?: number };
    if (data.sessionEpoch) {
      setEpoch(data.sessionEpoch);
    }
    setBusy(false);
    router.refresh();
  }

  async function addIp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/security/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAddress: ip, reason }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка добавления IP");
      setBusy(false);
      return;
    }
    setIp("");
    setReason("");
    setBusy(false);
    router.refresh();
  }

  async function removeIp(ipAddress: string) {
    if (!confirm(`Разблокировать ${ipAddress}?`)) {
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/security/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAddress }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка удаления");
      setBusy(false);
      return;
    }
    setBlocked((current) => current.filter((row) => row.ipAddress !== ipAddress));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card title="Сессии">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Текущий порог сброса:{" "}
          <span className="font-mono">{epoch || "—"}</span>
          {epoch
            ? ` (${formatDateTime(new Date(epoch * 1000).toISOString())})`
            : ""}
          . Все входы до этого времени недействительны.
        </p>
        <Button
          type="button"
          variant="danger"
          disabled={busy}
          onClick={() => void revokeSessions()}
        >
          Сбросить все сессии
        </Button>
      </Card>

      <Card title="Блоклист IP">
        <form onSubmit={addIp} className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            label="IP"
            value={ip}
            onChange={(event) => setIp(event.target.value)}
            placeholder="34.16.206.147"
            required
          />
          <Input
            label="Причина"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Сканер / брутфорс"
          />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="min-h-11 w-full">
              Заблокировать
            </Button>
          </div>
        </form>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        {blocked.length === 0 ? (
          <p className="text-[var(--muted)]">Блоклист пуст.</p>
        ) : (
          <div className="space-y-2">
            {blocked.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl bg-[var(--bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{row.ipAddress}</span>
                    <Badge tone={row.source === "static" ? "warning" : "neutral"}>
                      {row.source === "static" ? "встроенный" : "ручной"}
                    </Badge>
                  </div>
                  {row.reason ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">{row.reason}</p>
                  ) : null}
                </div>
                {row.source === "db" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void removeIp(row.ipAddress)}
                  >
                    Разблокировать
                  </Button>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    Снимается через BLOCKED_IPS в .env
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
