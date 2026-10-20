import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  buildHuntingSummaryText,
  collectHunting,
  getHuntingLastFetch,
  getHuntingOverview,
  shortDate,
} from "@/lib/hunting";
import {
  HUNTING_TIERS,
  priceForTier,
  type HuntingOverview,
  type HuntingSeasonEntry,
  type HuntingTier,
} from "@/lib/hunting-shared";
import {
  callTelegramApi,
  getPublicSiteUrl,
  getTelegramChannelConfig,
  sendTelegramMessage,
  sendTelegramTo,
} from "@/lib/telegram";
import { formatMoscow, moscowWeekday } from "@/lib/timezone";

export const HUNTING_WEBHOOK_PATH = "/api/telegram/hunting";

/** Сверка с mooir.ru по расписанию — не чаще, чем раз в столько часов. */
const SCHEDULE_COLLECT_HOURS = 6;
const REMIND_DAYS_BEFORE = 3;
const SEND_FROM_HOUR = 9;
const SEND_TO_HOUR = 21;

/** Секрет webhook выводится из токена: ничего лишнего прописывать на сервере не нужно. */
export function huntingWebhookSecret(): string | null {
  const { token } = getTelegramChannelConfig("hunting");
  return token
    ? createHash("sha256").update(`${token}:shapecraft-hunting-webhook`).digest("hex").slice(0, 48)
    : null;
}

type Species = {
  command: string;
  title: string;
  /** Совпадение с видом в распоряжении и с нормами добычи. */
  match: RegExp;
  /** Раздел прейскуранта (пернатая / пушные) либо строка с копытным. */
  price: RegExp;
};

const SPECIES: Species[] = [
  { command: "utka", title: "Утка", match: /(?<![а-яё])ут(ка|ки|ок|ку)|водоплава/i, price: /пернат/i },
  { command: "gus", title: "Гусь", match: /гус|водоплава/i, price: /пернат/i },
  { command: "valdshnep", title: "Вальдшнеп", match: /вальдшнеп|боров/i, price: /пернат/i },
  { command: "teterev", title: "Тетерев и глухарь", match: /тетерев|глухар|боров/i, price: /пернат/i },
  { command: "bekas", title: "Бекас и болотная дичь", match: /бекас|дупел|болотно/i, price: /пернат/i },
  { command: "zayac", title: "Заяц", match: /зай|заяц/i, price: /пушн/i },
  { command: "lisa", title: "Лиса и енотовидная собака", match: /лис|енот/i, price: /пушн/i },
  { command: "volk", title: "Волк", match: /волк/i, price: /пушн/i },
  { command: "bobr", title: "Бобр", match: /бобр/i, price: /пушн/i },
  { command: "barsuk", title: "Барсук", match: /барсук/i, price: /пушн/i },
  { command: "kaban", title: "Кабан", match: /кабан|копытн/i, price: /кабан/i },
  { command: "los", title: "Лось", match: /лос(ь|я|ей|ю|ям)(?![а-яё])|копытн/i, price: /лось/i },
  { command: "kosulya", title: "Косуля", match: /косул|копытн/i, price: /косул/i },
  { command: "olen", title: "Олень", match: /олен|копытн/i, price: /олен/i },
];

const BASE_COMMANDS: { command: string; description: string }[] = [
  { command: "sezon", description: "Что открыто и что скоро в Шатуре" },
  { command: "ceny", description: "Цены путёвок МООиР" },
  { command: "kontakty", description: "Шатурское хозяйство: адрес, егеря" },
  { command: "help", description: "Все команды" },
];

const TIER_ARGS: Record<string, HuntingTier> = {
  sobaka: "member-dogs",
  собака: "member-dogs",
  vznos: "fee",
  взнос: "fee",
  vznos_sobaka: "fee-dogs",
  rors: "rors",
  рорс: "rors",
  gost: "guest",
  гость: "guest",
};

function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function entryStatus(entry: HuntingSeasonEntry): string {
  if (entry.status === "open") {
    return entry.days === 0 ? "сегодня последний день" : `открыта, ещё ${entry.days} дн.`;
  }
  if (entry.status === "upcoming") {
    return entry.days === 1 ? "открывается завтра" : `откроется через ${entry.days} дн.`;
  }
  return "закрыта";
}

function entryLine(entry: HuntingSeasonEntry): string {
  const status =
    entry.scope === "excluded" ? "в Шатуре не открыта (хозяйства нет в списке)" : entryStatus(entry);
  return `• ${entry.label}\n   ${shortDate(entry.start)} – ${shortDate(entry.end, true)} — ${status}`;
}

function helpText(): string {
  return [
    "🦆 Бот охоты в Шатуре (МООиР)",
    "",
    "/sezon — что открыто и что скоро",
    "/ceny — цены путёвок (/ceny sobaka, /ceny vznos, /ceny gost)",
    "/kontakty — адрес и егеря Шатурского хозяйства",
    "",
    "По видам:",
    SPECIES.map((species) => `/${species.command} — ${species.title.toLowerCase()}`).join("\n"),
    "",
    "Данные — из распоряжений МООиР на mooir.ru, бот сверяется с ними сам.",
  ].join("\n");
}

function pricesText(overview: HuntingOverview, tier: HuntingTier): string {
  const prices = overview.prices;
  if (!prices) {
    return "Прейскурант пока не загружен — попробуйте позже.";
  }
  const tierInfo = HUNTING_TIERS.find((item) => item.id === tier)!;
  const lines = [`💰 Цены путёвок МООиР — ${tierInfo.label} (${tierInfo.hint})`];
  let section = "";
  for (const row of prices.rows) {
    if (row.section !== section) {
      section = row.section;
      lines.push("", `${section}:`);
    }
    const price = priceForTier(row.prices, tier);
    const value =
      price != null
        ? `${tier === "guest" ? "от " : ""}${formatRub(price)}`
        : row.prices[2] != null && (tier === "member" || tier === "member-dogs")
          ? "только со спецвзносом"
          : "уточнить";
    lines.push(`• ${row.label} — ${value}`);
  }
  lines.push(
    "",
    "Другие категории: /ceny sobaka · /ceny vznos · /ceny vznos_sobaka · /ceny rors · /ceny gost",
    `Прейскурант: ${prices.url}`,
  );
  return lines.join("\n");
}

function contactsText(overview: HuntingOverview): string {
  const contacts = overview.contacts;
  if (!contacts) {
    return "Контакты пока не загружены — попробуйте позже.";
  }
  return [
    "📍 Шатурское хозяйство МООиР",
    "",
    ...contacts.lines,
    "",
    ...contacts.links.map((link) => `${link.label}: ${link.url}`),
  ].join("\n");
}

function speciesText(species: Species, overview: HuntingOverview): string {
  const all = overview.orders.flatMap((order) =>
    order.entries
      .filter((entry) => species.match.test(entry.label))
      .map((entry) => ({ ...entry, orderTitle: order.title, orderUrl: order.url })),
  );
  const seen = new Set<string>();
  const unique = all.filter((entry) => {
    const key = `${entry.label}|${entry.start}|${entry.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const current = unique.filter((entry) => entry.status !== "closed");
  const lines = [`🎯 ${species.title} — Шатура`];

  if (current.length > 0) {
    lines.push("", ...current.map(entryLine));
  } else if (unique.length > 0) {
    lines.push("", "Сейчас закрыта. Последние сроки по распоряжениям МООиР:", ...unique.slice(0, 3).map(entryLine));
  } else {
    lines.push("", "В свежих распоряжениях МООиР этого вида нет — сроки уточняйте у егеря (/kontakty).");
  }

  const sources = [...new Map((current.length ? current : unique.slice(0, 3)).map((e) => [e.orderUrl, e])).values()];
  if (sources.length > 0) {
    lines.push("", ...sources.map((entry) => `${entry.orderTitle}: ${entry.orderUrl}`));
  }

  const rules = [
    ...new Set(overview.orders.flatMap((order) => order.rules.filter((rule) => species.match.test(rule)))),
  ].slice(0, 4);
  if (rules.length > 0) {
    lines.push("", "Нормы и способы:", ...rules.map((rule) => `• ${rule}`));
  }

  const priceRows = (overview.prices?.rows ?? []).filter(
    (row) => species.price.test(row.section) || species.price.test(row.label),
  );
  if (priceRows.length > 0) {
    lines.push("", "Путёвка (член МООиР / с собакой / со спецвзносом):");
    for (const row of priceRows) {
      const [member, dogs, fee] = row.prices;
      const parts = [
        member != null ? formatRub(member) : null,
        dogs != null && dogs !== member ? `с собакой ${formatRub(dogs)}` : null,
        fee != null ? `спецвзнос ${formatRub(fee)}` : null,
      ].filter(Boolean);
      lines.push(`• ${row.label} — ${parts.join(", ")}${member == null ? " (только со спецвзносом)" : ""}`);
    }
    lines.push("Не члены МООиР — от ×5, Росохотрыболовсоюз — ×2. Все цены: /ceny");
  }
  return lines.join("\n");
}

function findSpeciesByText(text: string): Species | undefined {
  const value = text.trim().toLowerCase();
  return (
    SPECIES.find((species) => species.command === value) ??
    SPECIES.find((species) => value.length >= 3 && species.match.test(value))
  );
}

export async function buildHuntingReply(command: string, arg = ""): Promise<string | null> {
  const overview = await getHuntingOverview();
  switch (command) {
    case "start":
    case "help":
      return helpText();
    case "sezon":
      return buildHuntingSummaryText(overview);
    case "ceny":
      return pricesText(overview, TIER_ARGS[arg.trim().toLowerCase()] ?? "member");
    case "kontakty":
      return contactsText(overview);
    default: {
      const species = SPECIES.find((item) => item.command === command);
      return species ? speciesText(species, overview) : null;
    }
  }
}

let botUsername: string | null = null;

async function getBotUsername(): Promise<string | null> {
  if (botUsername) {
    return botUsername;
  }
  const me = await callTelegramApi<{ username?: string }>("hunting", "getMe");
  botUsername = me.result?.username?.toLowerCase() ?? null;
  return botUsername;
}

type TelegramUpdate = {
  message?: {
    text?: string;
    message_thread_id?: number;
    chat?: { id: number; type?: string };
  };
};

/** Входящее сообщение: команды в группе и в личке, в личке — ещё и слово «утка», «кабан»… */
export async function handleHuntingUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const text = message?.text?.trim();
  const chat = message?.chat;
  if (!text || !chat) {
    return;
  }
  const isPrivate = chat.type === "private";

  let reply: string | null = null;
  if (text.startsWith("/")) {
    const [head, ...rest] = text.slice(1).split(/\s+/);
    const [command, mention] = head.toLowerCase().split("@");
    if (mention && mention !== (await getBotUsername())) {
      return;
    }
    reply = await buildHuntingReply(command, rest.join(" "));
    if (!reply && isPrivate) {
      reply = helpText();
    }
  } else if (isPrivate) {
    const species = findSpeciesByText(text);
    reply = species ? speciesText(species, await getHuntingOverview()) : helpText();
  }

  if (reply) {
    await sendTelegramTo("hunting", chat.id, reply, message?.message_thread_id ?? null);
  }
}

/** Привязывает бота к сайту: webhook для команд и меню команд в Telegram. */
export async function connectHuntingBot(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const secret = huntingWebhookSecret();
  if (!secret) {
    return { ok: false, error: "TELEGRAM_HUNTING_BOT_TOKEN не задан" };
  }
  const webhook = await callTelegramApi("hunting", "setWebhook", {
    url: `${getPublicSiteUrl()}${HUNTING_WEBHOOK_PATH}`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  if (!webhook.ok) {
    return { ok: false, error: `setWebhook: ${webhook.error}` };
  }
  const commands = [
    ...BASE_COMMANDS,
    ...SPECIES.map((species) => ({ command: species.command, description: species.title })),
  ];
  const menu = await callTelegramApi("hunting", "setMyCommands", { commands });
  if (!menu.ok) {
    return { ok: false, error: `setMyCommands: ${menu.error}` };
  }
  botUsername = null;
  return { ok: true, username: (await getBotUsername()) ?? undefined };
}

async function alreadySent(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) {
    return new Set();
  }
  const rows = await prisma.huntingNotice.findMany({ where: { key: { in: keys } }, select: { key: true } });
  return new Set(rows.map((row) => row.key));
}

async function markSent(keys: string[]) {
  for (const key of keys) {
    await prisma.huntingNotice.upsert({ where: { key }, create: { key }, update: {} });
  }
}

function dayBefore(key: string): string {
  return new Date(Date.parse(key) - 86_400_000).toISOString().slice(0, 10);
}

/** «Через 3 дня открывается», «сегодня открылась», «скоро закрывается» — одним сообщением. */
async function sendReminders(overview: HuntingOverview) {
  const seen = new Set<string>();
  const entries = overview.orders
    .flatMap((order) => order.entries)
    .filter((entry) => {
      const key = `${entry.label}|${entry.start}|${entry.end}`;
      if (entry.scope === "excluded" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const yesterday = dayBefore(overview.today);
  const groups: { title: string; key: string; entry: HuntingSeasonEntry; line: string }[] = [];
  for (const entry of entries) {
    const id = `${entry.label}|${entry.start}|${entry.end}`;
    if (entry.status === "upcoming" && entry.days <= REMIND_DAYS_BEFORE) {
      groups.push({
        title: "Скоро открывается",
        key: `soon:${id}`,
        entry,
        line: `• ${entry.label} — с ${shortDate(entry.start)} (${entry.days === 1 ? "завтра" : `через ${entry.days} дн.`})`,
      });
    }
    if (entry.status === "open" && entry.start >= yesterday) {
      groups.push({
        title: "Открылась",
        key: `open:${id}`,
        entry,
        line: `• ${entry.label} — до ${shortDate(entry.end, true)}`,
      });
    }
    if (entry.status === "open" && entry.days <= REMIND_DAYS_BEFORE && entry.start < yesterday) {
      groups.push({
        title: "Скоро закрывается",
        key: `close:${id}`,
        entry,
        line: `• ${entry.label} — до ${shortDate(entry.end, true)}${entry.days === 0 ? " (сегодня последний день)" : ""}`,
      });
    }
  }

  const sent = await alreadySent(groups.map((group) => group.key));
  const fresh = groups.filter((group) => !sent.has(group.key));
  if (fresh.length === 0) {
    return;
  }

  const lines = ["🔔 Охота в Шатуре — напоминание"];
  for (const title of ["Скоро открывается", "Открылась", "Скоро закрывается"]) {
    const items = fresh.filter((group) => group.title === title);
    if (items.length > 0) {
      lines.push("", `${title}:`, ...items.map((group) => group.line));
    }
  }
  lines.push("", "Путёвки и цены: /ceny · контакты: /kontakty");

  const result = await sendTelegramMessage(lines.join("\n"), "hunting");
  if (result.ok) {
    await markSent(fresh.map((group) => group.key));
  }
}

/** Один проход расписания: сверка с МООиР, напоминания, сводка по понедельникам. */
export async function runHuntingSchedule(now = new Date()): Promise<void> {
  const lastFetch = await getHuntingLastFetch();
  if (!lastFetch || now.getTime() - lastFetch.getTime() > SCHEDULE_COLLECT_HOURS * 3_600_000) {
    await collectHunting().catch((error) => console.error("hunting collect", error));
  }

  if (!getTelegramChannelConfig("hunting").configured) {
    return;
  }
  const hour = Number(formatMoscow(now, { hour: "2-digit", hourCycle: "h23" }));
  if (hour < SEND_FROM_HOUR || hour >= SEND_TO_HOUR) {
    return;
  }

  const overview = await getHuntingOverview();
  await sendReminders(overview);

  if (moscowWeekday(now) === 1) {
    const key = `weekly:${overview.today}`;
    if ((await alreadySent([key])).size === 0) {
      const result = await sendTelegramMessage(buildHuntingSummaryText(overview), "hunting");
      if (result.ok) {
        await markSent([key]);
      }
    }
  }
}