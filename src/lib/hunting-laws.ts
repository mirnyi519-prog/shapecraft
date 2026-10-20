import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchHtml, huntingChannel } from "@/lib/hunting";
import { escapeHtml } from "@/lib/hunting-format";
import {
  LAW_GROUPS,
  LAW_WATCH,
  parseArticle,
  parseEditionDetail,
  parseEditionList,
  parseTitleEdition,
  ruDateKey,
  type LawAmendment,
  type LawEdition,
  type LawState,
  type LawWatch,
} from "@/lib/hunting-laws-shared";
import { ymdKey } from "@/lib/hunting-shared";
import { getPublicSiteUrl, sendTelegramMessage } from "@/lib/telegram";
import { moscowYmd } from "@/lib/timezone";

/** Сколько последних редакций держим и показываем по закону с обзором изменений. */
const EDITIONS_KEPT = 6;
/** Подробности «что изменилось» — только для свежих редакций каждого закона. */
const DETAILED_EDITIONS = 3;
/** Страниц «что изменилось» за один проход — КонсультантПлюс не стоит дёргать пачкой. */
const DETAILS_PER_RUN = 8;
const REQUEST_PAUSE_MS = 700;
const CHANGES_IN_MESSAGE = 6;

const pause = () => new Promise((resolve) => setTimeout(resolve, REQUEST_PAUSE_MS));

type StoredData = { editions?: LawEdition[]; amendments?: LawAmendment[] };

function parseData(value: string): StoredData {
  try {
    return value ? (JSON.parse(value) as StoredData) : {};
  } catch {
    return {};
  }
}

function sha(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

type Collected = {
  edition: string;
  data: StoredData;
  hash: string;
  /** Что сообщить в группу, если документ уже отслеживался. */
  fresh: { editions?: LawEdition[]; amendment?: LawAmendment | null; edition?: string };
};

async function collectOverview(
  url: string,
  stored: StoredData | null,
  budget: { details: number },
): Promise<Collected> {
  const list = parseEditionList(await fetchHtml(url)).slice(0, EDITIONS_KEPT);
  if (list.length === 0) {
    throw new Error("список редакций не найден");
  }
  const known = new Map((stored?.editions ?? []).map((edition) => [edition.url, edition]));
  const editions: LawEdition[] = [];
  for (const edition of list) {
    const previous = known.get(edition.url);
    if (previous?.basis || previous?.changes.length) {
      editions.push({ ...edition, basis: previous.basis, changes: previous.changes });
      continue;
    }
    if (budget.details > 0 && editions.length < DETAILED_EDITIONS) {
      budget.details -= 1;
      await pause();
      try {
        editions.push({ ...edition, ...parseEditionDetail(await fetchHtml(edition.url)) });
        continue;
      } catch {
        // страница редакции не открылась — сохраняем без подробностей, дочитаем в следующий раз
      }
    }
    editions.push(edition);
  }
  const fresh = stored ? editions.filter((edition) => !known.has(edition.url)) : [];
  return {
    edition: editions[0].date,
    data: { editions },
    hash: sha(editions.map((edition) => edition.url).join("\n")),
    fresh: { editions: fresh },
  };
}

async function collectTitle(watch: LawWatch, stored: { edition: string } | null): Promise<Collected> {
  const edition = parseTitleEdition(await fetchHtml(watch.url));
  if (!edition) {
    throw new Error("в заголовке нет «ред. от»");
  }
  return {
    edition,
    data: {},
    hash: sha(edition),
    fresh: stored && stored.edition !== edition ? { edition } : {},
  };
}

async function collectArticle(watch: LawWatch, stored: { hash: string } | null): Promise<Collected> {
  const { text, amendments } = parseArticle(await fetchHtml(watch.url));
  if (text.length < 200) {
    throw new Error("текст статьи не найден");
  }
  const hash = sha(text);
  return {
    edition: amendments[0]?.date ?? "",
    data: { amendments: amendments.slice(0, 5) },
    hash,
    fresh: stored && stored.hash !== hash ? { amendment: amendments[0] ?? null } : {},
  };
}

export type LawsCollectResult = { ok: boolean; checked: number; changed: string[]; errors: string[] };

let running: Promise<LawsCollectResult> | null = null;

/** Обходит КонсультантПлюс по списку законов. Первый проход только запоминает, в группу не пишет. */
export function collectLaws(): Promise<LawsCollectResult> {
  running ??= runCollect().finally(() => {
    running = null;
  });
  return running;
}

async function runCollect(): Promise<LawsCollectResult> {
  const errors: string[] = [];
  const changed: string[] = [];
  const budget = { details: DETAILS_PER_RUN };
  const now = new Date();
  let checked = 0;

  for (const watch of LAW_WATCH) {
    const stored = await prisma.huntingLaw.findUnique({ where: { key: watch.key } });
    try {
      if (checked > 0) await pause();
      const storedData = stored ? parseData(stored.dataJson) : null;
      const result =
        watch.track.kind === "overview"
          ? await collectOverview(watch.track.url, storedData, budget)
          : watch.track.kind === "title"
            ? await collectTitle(watch, stored)
            : await collectArticle(watch, stored);
      checked += 1;

      const dataJson = JSON.stringify(result.data);
      const isChanged = Boolean(stored && stored.hash !== result.hash);
      await prisma.huntingLaw.upsert({
        where: { key: watch.key },
        create: { key: watch.key, edition: result.edition, dataJson, hash: result.hash, changedAt: now, fetchedAt: now },
        update: {
          edition: result.edition,
          dataJson,
          hash: result.hash,
          fetchedAt: now,
          ...(isChanged ? { changedAt: now } : {}),
        },
      });
      if (isChanged) {
        changed.push(watch.title);
        await notifyLawChange(watch, result.fresh).catch((error) => console.error("law notify", error));
      }
    } catch (error) {
      errors.push(`${watch.title}: ${error instanceof Error ? error.message : "ошибка"}`);
    }
  }
  return { ok: checked > 0, checked, changed, errors };
}

function editionHeading(edition: LawEdition): string {
  return edition.inForce
    ? `Редакция от ${edition.date} — вступает в силу с <b>${edition.inForce}</b>`
    : `Редакция от ${edition.date}`;
}

function changesLines(changes: string[]): string[] {
  const lines = changes.slice(0, CHANGES_IN_MESSAGE).map((change) => `• ${escapeHtml(change)}`);
  if (changes.length > CHANGES_IN_MESSAGE) {
    lines.push(`<i>…и ещё ${changes.length - CHANGES_IN_MESSAGE}</i>`);
  }
  return lines;
}

export type LawChange = Collected["fresh"];

async function notifyLawChange(watch: LawWatch, fresh: LawChange) {
  const channel = huntingChannel();
  if (!channel) {
    return;
  }
  const lines = [buildLawChangeHtml(watch, fresh)];
  if (channel === "ops") {
    lines.push(`Страница: ${getPublicSiteUrl()}/other/laws`);
  }
  await sendTelegramMessage(lines.join("\n"), channel, { html: true });
}

export function buildLawChangeHtml(watch: LawWatch, fresh: LawChange): string {
  const lines = ["⚖️ <b>Изменения в законодательстве</b>", `<b>${escapeHtml(watch.title)}</b>`];

  if (fresh.editions?.length) {
    for (const edition of fresh.editions) {
      lines.push("", `📌 ${editionHeading(edition)}`);
      if (edition.basis) lines.push(`<i>Внесено ${escapeHtml(edition.basis)}</i>`);
      lines.push(...changesLines(edition.changes));
      lines.push(`<a href="${escapeHtml(edition.url)}">Что изменилось — сравнение редакций</a>`);
    }
  } else if (fresh.edition) {
    lines.push("", `📌 Новая редакция от ${fresh.edition}`, `<a href="${escapeHtml(watch.url)}">Текст документа</a>`);
  } else {
    lines.push("", "📌 Изменился текст статьи");
    if (fresh.amendment) {
      lines.push(`<i>Последняя поправка: закон от ${fresh.amendment.date} ${escapeHtml(fresh.amendment.law)}</i>`);
    }
    lines.push(`<a href="${escapeHtml(watch.url)}">Текст статьи</a>`);
  }

  lines.push("", `ℹ️ Кратко о законах — /zakony`);
  return lines.join("\n");
}

export async function getLawStates(): Promise<Map<string, LawState>> {
  const rows = await prisma.huntingLaw.findMany();
  return new Map(
    rows.map((row) => {
      const data = parseData(row.dataJson);
      return [
        row.key,
        {
          key: row.key,
          edition: row.edition,
          editions: data.editions ?? [],
          amendments: data.amendments ?? [],
          changedAt: row.changedAt.toISOString(),
          fetchedAt: row.fetchedAt.toISOString(),
        },
      ];
    }),
  );
}

export async function getLawsLastFetch(): Promise<Date | null> {
  const latest = await prisma.huntingLaw.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } });
  return latest?.fetchedAt ?? null;
}

export const LAWS_STALE_HOURS = 12;

export function isLawsStale(lastFetch: Date | null): boolean {
  return !lastFetch || Date.now() - lastFetch.getTime() > LAWS_STALE_HOURS * 3_600_000;
}

/** Редакции, которые вступают в силу в указанный день (ГГГГ-ММ-ДД). */
export function lawsInForceOn(states: Map<string, LawState>, dayKey: string) {
  return LAW_WATCH.flatMap((watch) =>
    (states.get(watch.key)?.editions ?? [])
      .filter((edition) => edition.inForce && ruDateKey(edition.inForce) === dayKey)
      .map((edition) => ({ watch, edition })),
  );
}

export function buildLawsInForceHtml(items: ReturnType<typeof lawsInForceOn>): string {
  const lines = ["⚖️ <b>Сегодня вступают в силу изменения</b>"];
  for (const { watch, edition } of items) {
    lines.push("", `<b>${escapeHtml(watch.title)}</b>`, `Редакция от ${edition.date}`);
    if (edition.basis) lines.push(`<i>Внесено ${escapeHtml(edition.basis)}</i>`);
    lines.push(...changesLines(edition.changes));
    lines.push(`<a href="${escapeHtml(edition.url)}">Что изменилось</a>`);
  }
  return lines.join("\n");
}

/** Команды бота: /zakony — обзор, остальные — по документам из LAW_WATCH. */
export const LAW_COMMANDS: { command: string; description: string }[] = [
  { command: "zakony", description: "Законы об охоте и оружии — кратко" },
  { command: "zakon_ohota", description: "Закон «Об охоте»" },
  { command: "pravila", description: "Правила охоты: документы и запреты" },
  { command: "zakon_oruzhie", description: "Закон «Об оружии»" },
  { command: "hranenie", description: "Хранение и перевозка оружия" },
  { command: "shtrafy", description: "Штрафы и ответственность" },
];

function statusLine(watch: LawWatch, state: LawState | undefined): string {
  if (!state?.edition) {
    return "редакция ещё не сверялась";
  }
  if (watch.track.kind === "article") {
    const last = state.amendments[0];
    return last ? `последняя поправка — ${last.date} ${escapeHtml(last.law)}` : "без поправок";
  }
  const pending = state.editions.find((edition) => edition.inForce && ruDateKey(edition.inForce) > todayKey());
  return pending
    ? `ред. от ${state.edition}, часть вступает в силу с ${pending.inForce}`
    : `ред. от ${state.edition}`;
}

function todayKey(): string {
  const ymd = moscowYmd();
  return ymdKey(ymd.year, ymd.month, ymd.day);
}

function lawsOverviewHtml(states: Map<string, LawState>): string {
  const lines = ["⚖️ <b>Законы для охотника</b>"];
  for (const group of LAW_GROUPS) {
    lines.push("", `${group.emoji} <b>${group.title.toUpperCase()}</b>`);
    for (const watch of LAW_WATCH.filter((item) => item.group === group.id)) {
      lines.push(`• ${escapeHtml(watch.title)} — /${watch.command}`, `   <i>${statusLine(watch, states.get(watch.key))}</i>`);
    }
  }
  lines.push(
    "",
    "Бот сверяется с КонсультантПлюс и пишет сюда о каждой новой редакции.",
    "Кратко пересказано — при расхождении верен текст закона.",
  );
  return lines.join("\n");
}

function lawDetailHtml(watch: LawWatch, state: LawState | undefined): string {
  const lines = [`<b>${escapeHtml(watch.title)}</b>`, `<i>${escapeHtml(watch.act)}</i>`, `Сейчас: ${statusLine(watch, state)}`, ""];
  lines.push(...watch.points.map((point) => `• ${escapeHtml(point)}`));
  const recent = (state?.editions ?? []).slice(0, 2);
  if (recent.length > 0) {
    lines.push("", "🆕 <b>Последние изменения</b>");
    for (const edition of recent) {
      const short = edition.basis.replace(/^Федеральным законом/, "закон").replace(/^Федеральными законами/, "законы");
      const basis = edition.basis ? ` — ${escapeHtml(short)}` : "";
      lines.push(`<a href="${escapeHtml(edition.url)}">${edition.inForce ? `с ${edition.inForce}` : `ред. ${edition.date}`}</a>${basis}`);
    }
  }
  lines.push(`<a href="${escapeHtml(watch.url)}">Текст на КонсультантПлюс</a>`);
  return lines.join("\n");
}

export async function buildLawsReply(command: string): Promise<string | null> {
  if (!LAW_COMMANDS.some((item) => item.command === command)) {
    return null;
  }
  const states = await getLawStates();
  if (command === "zakony") {
    return lawsOverviewHtml(states);
  }
  const acts = LAW_WATCH.filter((watch) => watch.command === command);
  return acts.map((watch) => lawDetailHtml(watch, states.get(watch.key))).join("\n\n— — —\n\n");
}
