import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppShell } from "@/components/app-shell";
import { HuntingPrices } from "@/components/hunting-prices";
import { HuntingRefreshButton } from "@/components/hunting-refresh-button";
import { Badge, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import {
  collectHunting,
  getHuntingLastFetch,
  getHuntingOverview,
  isHuntingStale,
} from "@/lib/hunting";
import {
  HUNTING_STALE_HOURS,
  MOOIR_ORDERS_URL,
  type HuntingSeasonEntry,
} from "@/lib/hunting-shared";
import { formatMoscow } from "@/lib/timezone";

function keyDate(key: string): Date {
  return new Date(`${key}T12:00:00+03:00`);
}

function formatPeriod(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const from = formatMoscow(keyDate(start), {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const to = formatMoscow(keyDate(end), { day: "numeric", month: "short", year: "numeric" });
  return `${from} – ${to}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function StatusBadge({ entry }: { entry: HuntingSeasonEntry }) {
  if (entry.status === "open") {
    return (
      <Badge tone="success">
        {entry.days === 0
          ? "последний день"
          : `открыта · ещё ${entry.days} ${plural(entry.days, "день", "дня", "дней")}`}
      </Badge>
    );
  }
  if (entry.status === "upcoming") {
    return (
      <Badge tone="warning">
        {entry.days === 1 ? "завтра" : `через ${entry.days} ${plural(entry.days, "день", "дня", "дней")}`}
      </Badge>
    );
  }
  return <Badge>закрыта</Badge>;
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

function PhoneLine({ line }: { line: string }) {
  const parts = line.split(/(\+?[78]\s*\(?\d{3}\)?\s*[\d\s-]{7,10}\d)/);
  return (
    <li>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={`tel:${part.replace(/[^\d+]/g, "")}`} className="whitespace-nowrap font-medium text-[var(--brand)]">
            {part.trim()}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </li>
  );
}

export default async function HuntingPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const lastFetch = await getHuntingLastFetch();
  let collectError = "";
  if (!lastFetch) {
    const result = await collectHunting().catch(() => null);
    if (!result?.ok) {
      collectError = result?.errors[0] ?? "mooir.ru не ответил";
    }
  } else if (isHuntingStale(lastFetch)) {
    after(() => collectHunting().then(() => undefined, () => undefined));
  }

  const overview = await getHuntingOverview();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Иное</p>
          <h1 className="text-2xl font-bold">Сезон охоты · МООиР Шатура</h1>
          <p className="text-[var(--muted)]">
            Бот сам читает официальные распоряжения и прейскурант МООиР: на кого, в какие сроки, какими способами и
            сколько стоит. Проверка — при открытии раз в {HUNTING_STALE_HOURS} ч и по кнопке; о новом распоряжении
            напишет в Telegram.
          </p>
          <HuntingRefreshButton />
          <p className="text-sm text-[var(--muted)]">
            {overview.fetchedAt
              ? `Сверено с mooir.ru: ${formatMoscow(overview.fetchedAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
              : "Ещё ни разу не сверялось"}
            {collectError ? ` · ошибка: ${collectError}` : ""}
          </p>
        </div>

        <Card title="Сейчас и скоро в Шатуре">
          {overview.now.length === 0 ? (
            <p className="text-[var(--muted)]">
              По действующим распоряжениям МООиР сейчас ничего не открыто и в ближайшие 45 дней не открывается.
              Весенние сроки обычно выходят в начале марта.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {overview.now.map((entry) => (
                <li key={`${entry.orderUrl}-${entry.label}-${entry.start}`} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{entry.label}</span>
                    <StatusBadge entry={entry} />
                  </div>
                  <p className="text-sm">{formatPeriod(entry.start, entry.end)}</p>
                  {entry.note ? <p className="text-sm text-[var(--muted)]">{entry.note}</p> : null}
                  <p className="text-xs text-[var(--muted)]">
                    <ExternalLink href={entry.orderUrl}>{entry.orderTitle}</ExternalLink>
                    {entry.orderTopic ? ` · ${entry.orderTopic}` : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {overview.prices ? (
          <Card
            title="Цены на путёвки"
            action={<ExternalLink href={overview.prices.url}>Прейскурант</ExternalLink>}
          >
            <HuntingPrices prices={overview.prices} />
          </Card>
        ) : null}

        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Распоряжения МООиР</h2>
            <ExternalLink href={MOOIR_ORDERS_URL}>Все на mooir.ru</ExternalLink>
          </div>
          {overview.orders.length === 0 ? (
            <p className="text-[var(--muted)]">Распоряжений пока нет — нажмите «Обновить».</p>
          ) : null}
          {overview.orders.map((order) => (
            <Card key={order.id}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <ExternalLink href={order.url}>{order.title}</ExternalLink>
                    {order.topic ? <p className="mt-1 text-sm text-[var(--muted)]">{order.topic}</p> : null}
                  </div>
                  {order.isNew ? <Badge tone="warning">новое</Badge> : null}
                </div>

                {order.entries.length > 0 ? (
                  <ul className="space-y-2">
                    {order.entries.map((entry) => (
                      <li
                        key={`${entry.label}-${entry.start}`}
                        className={`rounded-xl border border-[var(--border)] px-3 py-2 ${
                          entry.scope === "excluded" || entry.status === "closed" ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{entry.label}</span>
                          <StatusBadge entry={entry} />
                        </div>
                        <p className="text-sm">{formatPeriod(entry.start, entry.end)}</p>
                        {entry.note ? <p className="text-sm text-[var(--muted)]">{entry.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Сроков в тексте не нашёл — смотрите оригинал.</p>
                )}

                {order.rules.length > 0 ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-[var(--brand)]">
                      Способы, нормы добычи, документы
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {order.rules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <details className="text-sm">
                  <summary className="cursor-pointer text-[var(--muted)]">Полный текст</summary>
                  <div className="mt-2 max-h-96 space-y-1 overflow-y-auto whitespace-pre-line text-[var(--muted)]">
                    {order.text}
                  </div>
                </details>
              </div>
            </Card>
          ))}
        </div>

        {overview.contacts ? (
          <Card title="Шатурское хозяйство">
            <ul className="space-y-1 text-sm">
              {overview.contacts.lines.map((line) => (
                <PhoneLine key={line} line={line} />
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {overview.contacts.links.map((link) => (
                <ExternalLink key={link.url} href={link.url}>
                  {link.label}
                </ExternalLink>
              ))}
            </div>
          </Card>
        ) : null}

        <p className="text-xs text-[var(--muted)]">
          Источник — официальные документы МСОО «МООиР» на mooir.ru. Бот только пересказывает их: при расхождении верен
          оригинал, наличие путёвок и места уточняйте у егеря.
        </p>
      </div>
    </AppShell>
  );
}
