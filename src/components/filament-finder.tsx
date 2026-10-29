"use client";

import { useState } from "react";
import { Badge, Button, Card, chromeTab } from "@/components/ui";
import { formatDateTime, formatRub } from "@/lib/calculations";
import {
  FILAMENT_FRESH_DAYS,
  FILAMENT_PRESETS,
  MARKETPLACE_LABELS,
  type FilamentMarketplace,
  type FilamentPriceRow,
  type FilamentRecentQuery,
  type FilamentSummary,
  type YandexSearchResult,
} from "@/lib/filament-shared";

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) {
    return "только что";
  }
  if (minutes < 60) {
    return `${minutes} мин назад`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} ч назад`;
  }
  return formatDateTime(iso);
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[var(--brand)] hover:underline"
    >
      {children}
    </a>
  );
}

export function FilamentFinder({ recent }: { recent: FilamentRecentQuery[] }) {
  const [text, setText] = useState("PLA Basic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<FilamentSummary | null>(null);
  const [yandex, setYandex] = useState<YandexSearchResult | null>(null);
  const [recentList, setRecentList] = useState(recent);

  async function search(raw: string) {
    const value = raw.trim();
    if (!value) {
      setError("Что ищем? Например, PLA Basic");
      return;
    }
    setText(value.replace(/^bambu lab\s*/i, ""));
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/filament/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        summary?: FilamentSummary;
        yandex?: YandexSearchResult;
      } | null;
      if (!response.ok || !data?.summary) {
        setError(data?.error ?? "Поиск не удался");
        return;
      }
      setSummary(data.summary);
      setYandex(data.yandex ?? null);
      rememberRecent(data.summary);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  function rememberRecent(next: FilamentSummary) {
    setRecentList((list) => [
      {
        query: next.query,
        lastAt: new Date().toISOString(),
        bestPrice: next.best?.price ?? null,
        bestMarketplace: next.best?.marketplace ?? null,
      },
      ...list.filter((item) => item.query !== next.query),
    ].slice(0, 8));
  }

  function applySummary(next: FilamentSummary) {
    setSummary(next);
    rememberRecent(next);
  }

  return (
    <div className="space-y-6">
      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void search(text);
          }}
        >
          <div className="chrome-tabs in-card">
            {FILAMENT_PRESETS.map((preset) => {
              const active = text.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setText(preset)}
                  className={chromeTab(active)}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex min-h-12 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 ring-[var(--brand)] focus-within:ring-2">
              <span className="shrink-0 text-sm font-medium text-[var(--muted)]">Bambu Lab</span>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="PLA Matte черный"
                aria-label="Что ищем"
                className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
              />
            </label>
            <Button type="submit" className="min-h-12 px-6 text-base" disabled={busy}>
              {busy ? "Ищем…" : "Найти"}
            </Button>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Цвет можно дописать: «PLA Matte черный». Катушка и refill идут вместе — показываем
            самую низкую цену.
          </p>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </form>
      </Card>

      {summary ? (
        <FilamentResult
          summary={summary}
          yandex={yandex}
          onSummary={applySummary}
        />
      ) : null}

      {recentList.length > 0 ? (
        <Card title="Недавние поиски">
          <div className="divide-y divide-[var(--border)]">
            {recentList.map((item) => (
              <button
                key={item.query}
                type="button"
                disabled={busy}
                onClick={() => void search(item.query)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-[var(--brand)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.query}</span>
                  <span className="text-xs text-[var(--muted)]">{ago(item.lastAt)}</span>
                </span>
                <span className="shrink-0 text-right">
                  {item.bestPrice !== null ? (
                    <>
                      <span className="block font-bold text-[var(--brand)]">
                        {formatRub(item.bestPrice)}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {item.bestMarketplace ? MARKETPLACE_LABELS[item.bestMarketplace] : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-[var(--muted)]">нет свежих цен</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function FilamentResult({
  summary,
  yandex,
  onSummary,
}: {
  summary: FilamentSummary;
  yandex: YandexSearchResult | null;
  onSummary: (summary: FilamentSummary) => void;
}) {
  const best = summary.best;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-2xl border p-5 ${
          best ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] bg-white"
        }`}
      >
        <p className="text-sm text-[var(--muted)]">{summary.query}</p>
        {best ? (
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-[var(--brand-dark)]">{formatRub(best.price)}</p>
              <p className="mt-1 text-sm">
                Дешевле всего — <span className="font-semibold">{MARKETPLACE_LABELS[best.marketplace]}</span>{" "}
                · {ago(best.createdAt)}
              </p>
              {best.title ? (
                <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{best.title}</p>
              ) : null}
            </div>
            <ExternalLink href={best.url || summary.links[best.marketplace]}>
              Открыть ↗
            </ExternalLink>
          </div>
        ) : (
          <p className="mt-1 text-sm">
            Свежих цен пока нет. Откройте WB или Ozon ниже и запишите самую низкую.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <YandexCard summary={summary} yandex={yandex} onSummary={onSummary} />
        <ManualMarketplaceCard marketplace="wb" summary={summary} onSummary={onSummary} />
        <ManualMarketplaceCard marketplace="ozon" summary={summary} onSummary={onSummary} />
      </div>

      <HistoryCard summary={summary} onSummary={onSummary} />
    </div>
  );
}

function LatestLine({ row }: { row: FilamentPriceRow | undefined }) {
  if (!row) {
    return (
      <p className="text-sm text-[var(--muted)]">
        За {FILAMENT_FRESH_DAYS} дней цен не записывали.
      </p>
    );
  }
  return (
    <p className="text-sm">
      Последняя: <span className="font-bold">{formatRub(row.price)}</span>{" "}
      <span className="text-[var(--muted)]">· {ago(row.createdAt)}</span>
    </p>
  );
}

function YandexCard({
  summary,
  yandex,
  onSummary,
}: {
  summary: FilamentSummary;
  yandex: YandexSearchResult | null;
  onSummary: (summary: FilamentSummary) => void;
}) {
  return (
    <Card
      title={MARKETPLACE_LABELS.ym}
      action={<Badge tone="success">авто</Badge>}
      className="flex flex-col"
    >
      <div className="flex flex-1 flex-col gap-3">
        {yandex?.status === "ok" ? (
          <>
            {yandex.loose ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Точного совпадения нет — похожие товары Bambu Lab. В «лучшую цену» не идут.
              </p>
            ) : null}
            <ul className="space-y-2">
              {yandex.offers.map((offer) => (
                <li key={`${offer.url}-${offer.price}`}>
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-3 rounded-xl bg-[var(--bg)] px-3 py-2 hover:bg-[var(--brand-soft)]"
                  >
                    <span className="line-clamp-2 min-w-0 text-sm">{offer.title}</span>
                    <span className="shrink-0 font-bold tabular-nums">{formatRub(offer.price)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : yandex ? (
          <>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{yandex.message}</p>
            <LatestLine row={summary.latest.ym} />
            <ManualPriceForm marketplace="ym" query={summary.query} onSummary={onSummary} />
          </>
        ) : (
          <LatestLine row={summary.latest.ym} />
        )}
        <div className="mt-auto pt-1">
          <ExternalLink href={summary.links.ym}>Все предложения, дешёвые сверху ↗</ExternalLink>
        </div>
      </div>
    </Card>
  );
}

function ManualMarketplaceCard({
  marketplace,
  summary,
  onSummary,
}: {
  marketplace: FilamentMarketplace;
  summary: FilamentSummary;
  onSummary: (summary: FilamentSummary) => void;
}) {
  return (
    <Card
      title={MARKETPLACE_LABELS[marketplace]}
      action={<Badge>вручную</Badge>}
      className="flex flex-col"
    >
      <div className="flex flex-1 flex-col gap-3">
        <a
          href={summary.links[marketplace]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-dark)] hover:bg-[var(--brand-soft)]"
        >
          Открыть {MARKETPLACE_LABELS[marketplace]} — дешёвые сверху ↗
        </a>
        <LatestLine row={summary.latest[marketplace]} />
        <div className="mt-auto">
          <ManualPriceForm marketplace={marketplace} query={summary.query} onSummary={onSummary} />
        </div>
      </div>
    </Card>
  );
}

function ManualPriceForm({
  marketplace,
  query,
  onSummary,
}: {
  marketplace: FilamentMarketplace;
  query: string;
  onSummary: (summary: FilamentSummary) => void;
}) {
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/filament/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, marketplace, price, url }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        summary?: FilamentSummary;
      } | null;
      if (!response.ok || !data?.summary) {
        setError(data?.error ?? "Не удалось сохранить");
        return;
      }
      setPrice("");
      setUrl("");
      onSummary(data.summary);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex gap-2">
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="numeric"
          placeholder="Цена, ₽"
          aria-label={`Цена на ${MARKETPLACE_LABELS[marketplace]}`}
          className="min-h-11 w-28 rounded-xl border border-[var(--border)] bg-white px-3 text-base outline-none ring-[var(--brand)] focus:ring-2 sm:text-sm"
          required
        />
        <Button type="submit" className="min-h-11 flex-1" disabled={busy || !price.trim()}>
          {busy ? "…" : "Записать цену"}
        </Button>
      </div>
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        inputMode="url"
        placeholder="Ссылка на товар (необязательно)"
        aria-label="Ссылка на товар"
        className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base outline-none ring-[var(--brand)] focus:ring-2 sm:text-sm"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}

function HistoryCard({
  summary,
  onSummary,
}: {
  summary: FilamentSummary;
  onSummary: (summary: FilamentSummary) => void;
}) {
  const [busyId, setBusyId] = useState("");

  async function remove(id: string) {
    if (!window.confirm("Удалить эту запись цены?")) {
      return;
    }
    setBusyId(id);
    try {
      const response = await fetch(`/api/filament/prices?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { summary?: FilamentSummary } | null;
      if (response.ok && data?.summary) {
        onSummary(data.summary);
      }
    } finally {
      setBusyId("");
    }
  }

  if (summary.history.length === 0) {
    return null;
  }

  return (
    <Card title="История цен">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">Когда</th>
              <th className="py-2 pr-3 font-medium">Площадка</th>
              <th className="py-2 pr-3 text-right font-medium">Цена</th>
              <th className="hidden py-2 pr-3 font-medium md:table-cell">Товар</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {summary.history.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                <td className="whitespace-nowrap py-2 pr-3 text-[var(--muted)]">
                  {formatDateTime(row.createdAt)}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">
                  {MARKETPLACE_LABELS[row.marketplace]}
                  <span className="ml-1 text-xs text-[var(--muted)]">
                    {row.source === "auto" ? "авто" : "вручную"}
                  </span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-semibold tabular-nums">
                  {row.url ? <ExternalLink href={row.url}>{formatRub(row.price)}</ExternalLink> : formatRub(row.price)}
                </td>
                <td className="hidden max-w-sm truncate py-2 pr-3 text-[var(--muted)] md:table-cell">
                  {row.title || "—"}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void remove(row.id)}
                    disabled={busyId === row.id}
                    aria-label="Удалить запись"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-700"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
