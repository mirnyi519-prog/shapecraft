import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppShell } from "@/components/app-shell";
import { LawsRefreshButton } from "@/components/laws-refresh-button";
import { Badge, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { collectLaws, getLawsLastFetch, getLawStates, isLawsStale } from "@/lib/hunting-laws";
import {
  LAW_GROUPS,
  LAW_WATCH,
  REGIONAL_NOTES,
  ruDateKey,
  type LawState,
  type LawWatch,
} from "@/lib/hunting-laws-shared";
import { formatMoscow, moscowYmd } from "@/lib/timezone";

const FRESH_DAYS = 60;

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

function daysSince(ruDate: string, todayKey: string): number {
  return Math.round((Date.parse(todayKey) - Date.parse(ruDateKey(ruDate))) / 86_400_000);
}

function LawStatus({ watch, state, todayKey }: { watch: LawWatch; state?: LawState; todayKey: string }) {
  if (!state?.edition) {
    return <Badge>не сверялось</Badge>;
  }
  const pending = state.editions.find((edition) => edition.inForce && ruDateKey(edition.inForce) > todayKey);
  if (pending) {
    return <Badge tone="warning">с {pending.inForce} вступают изменения</Badge>;
  }
  const label =
    watch.track.kind === "article" ? `поправка от ${state.edition}` : `ред. от ${state.edition}`;
  return daysSince(state.edition, todayKey) <= FRESH_DAYS ? (
    <Badge tone="success">{label} · свежая</Badge>
  ) : (
    <Badge>{label}</Badge>
  );
}

function LawCard({ watch, state, todayKey }: { watch: LawWatch; state?: LawState; todayKey: string }) {
  const editions = state?.editions.slice(0, 3) ?? [];
  return (
    <Card>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <ExternalLink href={watch.url}>{watch.title}</ExternalLink>
            <p className="mt-1 text-sm text-[var(--muted)]">{watch.act}</p>
          </div>
          <LawStatus watch={watch} state={state} todayKey={todayKey} />
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm">
          {watch.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        {editions.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-[var(--brand)]">Последние редакции</summary>
            <ul className="mt-2 space-y-3">
              {editions.map((edition) => (
                <li key={edition.url} className="rounded-xl border border-[var(--border)] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ExternalLink href={edition.url}>Редакция от {edition.date}</ExternalLink>
                    {edition.inForce ? <Badge tone="warning">в силе с {edition.inForce}</Badge> : null}
                  </div>
                  {edition.basis ? <p className="text-[var(--muted)]">Внесено {edition.basis}</p> : null}
                  {edition.changes.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
                      {edition.changes.slice(0, 8).map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                      {edition.changes.length > 8 ? <li>…и ещё {edition.changes.length - 8}</li> : null}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {watch.track.kind === "article" && state?.amendments.length ? (
          <p className="text-xs text-[var(--muted)]">
            Поправки: {state.amendments.map((item) => `${item.date} ${item.law}`).join(" · ")}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export default async function LawsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const lastFetch = await getLawsLastFetch();
  let collectError = "";
  if (!lastFetch) {
    const result = await collectLaws().catch(() => null);
    if (!result?.ok) {
      collectError = result?.errors[0] ?? "КонсультантПлюс не ответил";
    }
  } else if (isLawsStale(lastFetch)) {
    after(() => collectLaws().then(() => undefined, () => undefined));
  }

  const states = await getLawStates();
  const fetchedAt = await getLawsLastFetch();
  const ymd = moscowYmd();
  const todayKey = `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Иное</p>
          <h1 className="text-2xl font-bold">Закон · охота и оружие</h1>
          <p className="text-[var(--muted)]">
            Коротко о главном в законах для охотника. Бот сам сверяет их с КонсультантПлюс (дважды в сутки) и пишет в
            охотничью группу о каждой новой редакции: что изменено и с какого числа, а в день вступления в силу
            напоминает ещё раз. В Telegram — команды /zakony, /pravila, /shtrafy, /hranenie, /zakon_ohota,
            /zakon_oruzhie.
          </p>
          <LawsRefreshButton />
          <p className="text-sm text-[var(--muted)]">
            {fetchedAt
              ? `Сверено с КонсультантПлюс: ${formatMoscow(fetchedAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
              : "Ещё ни разу не сверялось"}
            {collectError ? ` · ошибка: ${collectError}` : ""}
          </p>
        </div>

        {LAW_GROUPS.map((group) => (
          <div key={group.id} className="space-y-4">
            <h2 className="text-lg font-semibold">
              {group.emoji} {group.title}
            </h2>
            {LAW_WATCH.filter((watch) => watch.group === group.id).map((watch) => (
              <LawCard key={watch.key} watch={watch} state={states.get(watch.key)} todayKey={todayKey} />
            ))}
          </div>
        ))}

        <Card title="Московская область">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {REGIONAL_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Card>

        <p className="text-xs text-[var(--muted)]">
          Пересказ сокращённый и не заменяет текст закона: при расхождении верен оригинал на КонсультантПлюс или
          pravo.gov.ru.
        </p>
      </div>
    </AppShell>
  );
}
