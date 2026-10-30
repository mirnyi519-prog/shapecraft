import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { collectHunting, getHuntingLastFetch, getHuntingOverview } from "@/lib/hunting";
import {
  addDays,
  buildGatheringReminder,
  createGathering,
  GATHERING_REMIND_HOUR,
  GATHERING_USAGE,
  gatheringsForTomorrow,
  gatheringsOn,
  handleGatheringCallback,
  type TelegramUser,
  userName,
} from "@/lib/hunting-gathering";
import {
  buildWeatherHtml,
  fetchHuntingWeather,
  fetchSeasonSignals,
  fireDanger,
  fireDangerLine,
  seasonLines,
  stormWarnings,
  stormWarningsHtml,
} from "@/lib/hunting-weather";
import {
  DOCUMENTS_USAGE,
  handleDocumentCommand,
  listDocumentsText,
  reactivateDocuments,
  sendDocumentReminders,
} from "@/lib/hunting-documents";
import { type BotTopic, logBotUsage, pruneBotUsage } from "@/lib/hunting-usage";
import { type ChatTool, huntingChatEnabled, huntingChatReply, pruneHuntingChat } from "@/lib/hunting-chat";
import { type ActiveAlert, collectAlerts, getActiveQuarantines } from "@/lib/hunting-alerts";
import { trackSourceHealth } from "@/lib/hunting-health";
import {
  collectIncidents,
  handleIncidentCallback,
  handleNoiseCallback,
  handleSubscriptionCallback,
  huntingAdminId,
  sendHunterWarning,
  sendNoiseSuggestions,
  SUBSCRIPTION_TEXT,
  subscriptionKeyboard,
  weeklyMushroomPosts,
  weeklyNewsLines,
} from "@/lib/hunting-incidents";
import {
  AMMO_GENERAL,
  AMMO_GROUPS,
  AMMO_SEASONS,
  AMMO_TABLE,
  findAmmoGroup,
  findAmmoSpecies,
  formatAmmoTip,
  pickAmmo,
  seasonForMonth,
  seasonTitle,
  type AmmoSeason,
} from "@/lib/hunting-ammo";
import {
  buildLawsInForceHtml,
  buildLawsReply,
  collectLaws,
  getLawsLastFetch,
  getLawStates,
  isLawsStale,
  LAW_COMMANDS,
  lawsInForceOn,
} from "@/lib/hunting-laws";
import {
  buildHuntingSummaryHtml,
  escapeHtml,
  renderHuntItems,
  shortDate,
  toHuntItems,
} from "@/lib/hunting-format";
import {
  awaitedOrders,
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
  huntingExtraChatIds,
  sendTelegramMessage,
  sendTelegramTo,
} from "@/lib/telegram";
import { formatMoscow, moscowWeekday } from "@/lib/timezone";

export const HUNTING_WEBHOOK_PATH = "/api/telegram/hunting";

/** Сверка с mooir.ru по расписанию — не чаще, чем раз в столько часов. */
const SCHEDULE_COLLECT_HOURS = 6;
const REMIND_DAYS_BEFORE = 3;
/** С какого часа (МСК) в четверг публиковать погоду на выходные со сборами. */
const WEEKEND_WEATHER_HOUR = 12;
const SEND_FROM_HOUR = 9;
const SEND_TO_HOUR = 21;
/** Карантины и леса — не чаще, чем раз в столько часов. */
const ALERTS_EVERY_HOURS = 2;
/** Местные каналы о происшествиях — раз в час. */
const INCIDENTS_EVERY_HOURS = 1;

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
  { command: "pogoda", description: "Погода для охоты в Шатуре на 3 дня" },
  { command: "sbor", description: "Собрать людей на охоту: /sbor кабан 26.10" },
  { command: "patron", description: "Какой патрон брать на кого и в какой сезон" },
  { command: "dokumenty", description: "Сроки моих документов — напоминания в личку" },
  { command: "vnimanie", description: "Предупредить все охотничьи чаты: шипы, браконьеры…" },
  { command: "podpiska", description: "Новости в личку: звери, грибы, пожары…" },
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
    "/patron — какой патрон брать сейчас (/patron utka — по сезонам)",
    "/pogoda — погода, ветер, восход и закат на 3 дня, грибы и пожароопасность",
    "/sbor кабан 26.10 — собрать людей на охоту (в группе)",
    "/dokument роха 15.03.2027 — напомню о сроке документа (в личке), список — /dokumenty",
    "/vnimanie шипы на площадке у … — предупредить все охотничьи чаты (можно фото с подписью)",
    "/podpiska — новости в личку по темам: звери, грибы, пожары, лёд… (в личке)",
    "",
    "По видам:",
    SPECIES.map((species) => `/${species.command} — ${species.title.toLowerCase()}`).join("\n"),
    "",
    "Законы:",
    LAW_COMMANDS.map((item) => `/${item.command} — ${item.description.toLowerCase()}`).join("\n"),
    "",
    "Сроки и цены — из распоряжений МООиР на mooir.ru, законы — с КонсультантПлюс; бот сверяется с ними сам.",
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

/** Какие карантины важны для вида: АЧС — кабан, бешенство — лиса, енотовидная собака, волк. */
const QUARANTINE_SPECIES: Record<string, string[]> = {
  asf: ["kaban"],
  rabies: ["lisa", "volk"],
};

function speciesText(species: Species, overview: HuntingOverview, quarantines: ActiveAlert[] = []): string {
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
    const awaited = awaitedOrders(overview).find((item) => item.order.url === unique[0].orderUrl);
    lines.push(
      "",
      awaited
        ? `Распоряжение МООиР на сезон ${awaited.season} ещё не опубликовано — открыта ли охота сейчас, уточняйте у егеря (/kontakty). Сроки прошлого сезона:`
        : "Сейчас закрыта. Последние сроки по распоряжениям МООиР:",
      ...unique.slice(0, 3).map(entryLine),
    );
  } else {
    lines.push("", "В свежих распоряжениях МООиР этого вида нет — сроки уточняйте у егеря (/kontakty).");
  }

  for (const quarantine of quarantines) {
    if (QUARANTINE_SPECIES[quarantine.disease]?.includes(species.command)) {
      lines.push(
        "",
        quarantine.disease === "asf"
          ? "⚠️ В Шатуре действует карантин по АЧС: в зоне карантина загоном, нагоном и с собаками нельзя (п. 62.17)."
          : "⚠️ В Шатуре действует карантин по бешенству — будьте осторожны с добычей и собаками.",
        `${quarantine.title}: ${quarantine.url}`,
      );
    }
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

  const open = current.find((entry) => entry.status === "open");
  const upcoming = current.filter((entry) => entry.status === "upcoming").sort((a, b) => a.start.localeCompare(b.start))[0];
  const seasonDay = open ? overview.today : (upcoming?.start ?? overview.today);
  lines.push("", ...ammoLines(species.command, seasonForMonth(Number(seasonDay.slice(5, 7)))));
  return lines.join("\n");
}

function ammoLines(key: string, season: AmmoSeason): string[] {
  const pick = pickAmmo(key, season);
  if (!pick) {
    return [];
  }
  const when = seasonTitle(pick.season).toLowerCase();
  const lines = [
    pick.exact ? `🎯 Какой патрон взять (${when}):` : `🎯 Какой патрон взять — ближайший сезон (${when}):`,
    `• ${formatAmmoTip(pick.tip)}`,
    `  ${pick.tip.note}`,
  ];
  if (pick.species.rule) {
    lines.push(`⚠️ ${pick.species.rule}`);
  }
  lines.push(`Вся таблица по сезонам: /patron ${key}`);
  return lines;
}

function ammoText(arg: string, today: string): string {
  const row = findAmmoSpecies(arg);
  if (row) {
    const lines = [`🎯 ${row.title} — какой патрон брать`];
    for (const season of AMMO_SEASONS) {
      const tip = row.seasons[season.id];
      if (tip) {
        lines.push("", `${season.title} (${season.months}):`, `• ${formatAmmoTip(tip)}`, `  ${tip.note}`);
      }
    }
    if (Object.keys(row.seasons).length === 0) {
      lines.push("", "Рекомендаций нет — охота на вид, как правило, закрыта.");
    }
    if (row.rule) lines.push("", `⚠️ ${row.rule}`);
    lines.push("", AMMO_GENERAL[0]);
    return lines.join("\n");
  }

  const season = seasonForMonth(Number(today.slice(5, 7)));
  const group = findAmmoGroup(arg);
  const rows = AMMO_TABLE.filter((item) => (group ? item.group === group : item.popular));
  const groupTitle = group ? AMMO_GROUPS.find((item) => item.id === group)!.title.toLowerCase() : "";
  const lines = [`🎯 Патроны на сезон: ${seasonTitle(season).toLowerCase()}${groupTitle ? ` — ${groupTitle}` : ""}`];
  for (const item of rows) {
    const tip = item.seasons[season];
    if (tip) {
      lines.push(`• ${item.title} — ${formatAmmoTip(tip)}`);
    }
  }
  if (lines.length === 1) {
    lines.push("В этот сезон по этой группе рекомендаций нет.");
  }
  lines.push(
    "",
    "По виду: /patron рябчик, /patron кабан …",
    "По группам: /patron птица · /patron копытные · /patron пушные · /patron медведь",
    "Это рекомендации, а не закон: обязательные ограничения — /pravila.",
  );
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
      return buildHuntingSummaryHtml(overview);
    case "ceny":
      return pricesText(overview, TIER_ARGS[arg.trim().toLowerCase()] ?? "member");
    case "kontakty":
      return contactsText(overview);
    case "patron":
      return ammoText(arg, overview.today);
    case "pogoda": {
      const [days, signals, mushroomPosts] = await Promise.all([
        fetchHuntingWeather(3).catch(() => null),
        fetchSeasonSignals().catch(() => null),
        weeklyMushroomPosts().catch(() => 0),
      ]);
      return days
        ? buildWeatherHtml(days, undefined, seasonLines(signals, mushroomPosts))
        : "Прогноз сейчас недоступен — попробуйте позже.";
    }
    default: {
      const species = SPECIES.find((item) => item.command === command);
      return species ? speciesText(species, overview, await getActiveQuarantines()) : buildLawsReply(command);
    }
  }
}

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

const noArgs = { type: "object" as const, properties: {} };

/** Функции бота, которые GigaChat вызывает за фактами, — те же ответы, что и у команд. */
const CHAT_TOOLS: ChatTool[] = [
  {
    name: "sezon",
    description: "Какая охота сейчас открыта и что скоро откроется в Шатурском хозяйстве (сроки по распоряжениям МООиР)",
    parameters: noArgs,
    run: async () => plainText(buildHuntingSummaryHtml(await getHuntingOverview())),
  },
  {
    name: "vid_dichi",
    description: "Сроки охоты, нормы, карантины, цена путёвки и рекомендуемый патрон для конкретного вида дичи",
    parameters: {
      type: "object",
      properties: {
        vid: { type: "string", description: "Вид дичи: утка, гусь, вальдшнеп, тетерев, бекас, заяц, лиса, волк, бобр, барсук, кабан, лось, косуля, олень" },
      },
      required: ["vid"],
    },
    run: async ({ vid }) => {
      const species = findSpeciesByText(String(vid ?? ""));
      return species
        ? speciesText(species, await getHuntingOverview(), await getActiveQuarantines())
        : "Такого вида нет в справочнике бота.";
    },
  },
  {
    name: "ceny",
    description: "Цены путёвок МООиР для категории охотника",
    parameters: {
      type: "object",
      properties: {
        kategoriya: {
          type: "string",
          enum: HUNTING_TIERS.map((tier) => tier.id),
          description: HUNTING_TIERS.map((tier) => `${tier.id} — ${tier.label}`).join("; "),
        },
      },
    },
    run: async ({ kategoriya }) => {
      const tier = HUNTING_TIERS.find((item) => item.id === kategoriya)?.id ?? "member";
      return pricesText(await getHuntingOverview(), tier);
    },
  },
  {
    name: "kontakty",
    description: "Адрес Шатурского хозяйства, телефоны егерей, ссылки",
    parameters: noArgs,
    run: async () => contactsText(await getHuntingOverview()),
  },
  {
    name: "pogoda",
    description: "Погода в Шатуре на 3 дня: температура, ветер, осадки, восход и закат, грибы, пожароопасность",
    parameters: noArgs,
    run: async () => (await buildHuntingReply("pogoda").then((html) => plainText(html ?? ""))) || "Прогноз недоступен.",
  },
  {
    name: "patron",
    description: "Какой патрон (дробь, картечь, пуля) брать на вид дичи или на текущий сезон",
    parameters: {
      type: "object",
      properties: { vid: { type: "string", description: "Вид дичи или группа (птица, копытные, пушные); пусто — общий список на сезон" } },
    },
    run: async ({ vid }) => ammoText(String(vid ?? ""), (await getHuntingOverview()).today),
  },
  {
    name: "zakon",
    description: "Законы и правила: охота, оружие, хранение и перевозка, штрафы — с актуальной редакцией и ссылкой",
    parameters: {
      type: "object",
      properties: {
        tema: {
          type: "string",
          enum: LAW_COMMANDS.map((item) => item.command),
          description: LAW_COMMANDS.map((item) => `${item.command} — ${item.description}`).join("; "),
        },
      },
      required: ["tema"],
    },
    run: async ({ tema }) => plainText((await buildLawsReply(String(tema ?? "zakony"))) ?? "Такой темы нет."),
  },
  {
    name: "novosti",
    description: "Новости и происшествия за неделю: звери, браконьеры, погода, пожары, грибы",
    parameters: noArgs,
    run: async () => plainText((await weeklyNewsLines()).join("\n")),
  },
  {
    name: "komandy",
    description: "Список команд бота",
    parameters: noArgs,
    run: async () => helpText(),
  },
];

const CHAT_TOPIC: BotTopic = { section: "Разговор", topic: "ai", title: "Разговор с ботом (GigaChat)" };

const LAW_WORDS: [RegExp, string][] = [
  [/штраф|наказан|ответственн/i, "shtrafy"],
  [/хранен|сейф|перевоз/i, "hranenie"],
  [/оруж/i, "zakon_oruzhie"],
  [/правил/i, "pravila"],
  [/закон/i, "zakony"],
];

/** Ответы с разметкой Telegram HTML; остальные — простой текст. */
const HTML_REPLIES = new Set(["sezon", "pogoda", ...LAW_COMMANDS.map((item) => item.command)]);

let botUsername: string | null = null;

async function getBotUsername(): Promise<string | null> {
  if (botUsername) {
    return botUsername;
  }
  const me = await callTelegramApi<{ username?: string }>("hunting", "getMe");
  botUsername = me.result?.username?.toLowerCase() ?? null;
  return botUsername;
}

type TelegramChat = { id: number; type?: string; title?: string; username?: string };

type TelegramUpdate = {
  message?: {
    message_id?: number;
    text?: string;
    caption?: string;
    photo?: { file_id: string; width: number }[];
    message_thread_id?: number;
    chat?: TelegramChat;
    from?: TelegramUser;
    reply_to_message?: { from?: { username?: string } };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: TelegramUser;
    message?: { message_id?: number; chat?: TelegramChat };
  };
};

const COMMAND_TOPICS: Record<string, BotTopic> = {
  start: { section: "Справка", topic: "start", title: "Старт" },
  help: { section: "Справка", topic: "help", title: "Список команд" },
  sezon: { section: "Сезоны", topic: "sezon", title: "Что открыто и что скоро" },
  ceny: { section: "Цены", topic: "ceny", title: "Цены путёвок" },
  kontakty: { section: "Контакты", topic: "kontakty", title: "Адрес и егеря" },
  pogoda: { section: "Погода", topic: "pogoda", title: "Погода на 3 дня" },
  patron: { section: "Патроны", topic: "patron", title: "Какой патрон брать" },
  sbor: { section: "Сборы", topic: "sbor", title: "Создание сбора" },
  dokument: { section: "Документы", topic: "dokument", title: "Запись срока документа" },
  dokumenty: { section: "Документы", topic: "dokumenty", title: "Список документов" },
  vnimanie: { section: "Происшествия", topic: "vnimanie", title: "Предупреждение во все чаты" },
  podpiska: { section: "Происшествия", topic: "podpiska", title: "Подписка на новости" },
  myid: { section: "Справка", topic: "myid", title: "Мой Telegram id" },
};

function commandTopic(command: string): BotTopic {
  if (COMMAND_TOPICS[command]) {
    return COMMAND_TOPICS[command];
  }
  const species = SPECIES.find((item) => item.command === command);
  if (species) {
    return { section: "Виды дичи", topic: command, title: species.title };
  }
  const law = LAW_COMMANDS.find((item) => item.command === command);
  if (law) {
    return { section: "Закон", topic: command, title: law.description };
  }
  return { section: "Прочее", topic: command, title: `/${command}` };
}

function textTopic(text: string): BotTopic {
  if (/патрон|дроб|картеч/i.test(text)) {
    return { section: "Патроны", topic: "patron_text", title: "Патроны — вопрос текстом" };
  }
  const lawCommand = LAW_WORDS.find(([re]) => re.test(text))?.[1];
  if (lawCommand) {
    return commandTopic(lawCommand);
  }
  const species = findSpeciesByText(text);
  return species
    ? { section: "Виды дичи", topic: species.command, title: species.title }
    : { section: "Прочее", topic: "text", title: "Непонятый вопрос текстом" };
}

function isHuntingChat(chat: TelegramChat): boolean {
  const ids = [getTelegramChannelConfig("hunting").chatId, ...huntingExtraChatIds()];
  return ids.includes(String(chat.id)) || (chat.username != null && ids.includes(`@${chat.username}`));
}

/** Ответ по ключевым словам — когда GigaChat не подключён или не ответил. */
async function keywordReply(text: string): Promise<{ reply: string | null; html: boolean }> {
  if (/патрон|дроб|картеч/i.test(text)) {
    return {
      reply: ammoText(text.replace(/патрон\S*|дроб\S*|картеч\S*/gi, " "), (await getHuntingOverview()).today),
      html: false,
    };
  }
  const lawCommand = LAW_WORDS.find(([re]) => re.test(text))?.[1];
  if (lawCommand) {
    const reply = await buildLawsReply(lawCommand);
    return { reply, html: reply != null };
  }
  const species = findSpeciesByText(text);
  return {
    reply: species ? speciesText(species, await getHuntingOverview(), await getActiveQuarantines()) : helpText(),
    html: false,
  };
}

/**
 * Входящее сообщение: команды в группе и в личке. Свободный текст — разговор с GigaChat
 * (в группе — только по упоминанию бота или ответом на его сообщение), без него — ключевые слова в личке.
 */
export async function handleHuntingUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    const query = update.callback_query;
    if (query.data?.startsWith("inc:")) {
      await handleIncidentCallback(query);
      return;
    }
    if (query.data?.startsWith("noise:")) {
      await handleNoiseCallback(query);
      return;
    }
    if (query.data?.startsWith("sub:")) {
      await logBotUsage({
        from: query.from,
        chat: query.message?.chat ?? { id: query.from.id, type: "private" },
        topic: { section: "Происшествия", topic: "podpiska_toggle", title: "Подписка: кнопка рубрики" },
        text: query.data,
      });
      await handleSubscriptionCallback(query);
      return;
    }
    const answer = query.data?.split(":")[2];
    await logBotUsage({
      from: query.from,
      chat: query.message?.chat ?? { id: query.from.id, type: "private" },
      topic: { section: "Сборы", topic: "sbor_vote", title: "Голос в сборе" },
      text: answer ? `кнопка: ${answer}` : "",
    });
    await handleGatheringCallback(query);
    return;
  }
  const message = update.message;
  const text = (message?.text ?? message?.caption)?.trim();
  const chat = message?.chat;
  if (!text || !chat) {
    return;
  }
  const isPrivate = chat.type === "private";

  let reply: string | null = null;
  let html = false;
  if (text.startsWith("/")) {
    const [head, ...rest] = text.slice(1).split(/\s+/);
    const [command, mention] = head.toLowerCase().split("@");
    if (mention && mention !== (await getBotUsername())) {
      return;
    }
    await logBotUsage({
      from: message?.from,
      chat,
      topic: commandTopic(command),
      text: command === "dokument" || command === "dokumenty" ? `/${command}` : text,
    });
    if (command === "vnimanie" && message?.from) {
      const photo = message.photo?.reduce((best, size) => (size.width > best.width ? size : best));
      reply = await sendHunterWarning({
        from: message.from,
        chatId: chat.id,
        isHuntingChat: isHuntingChat(chat),
        text: text.slice(1 + head.length),
        photoFileId: photo?.file_id,
        messageId: message.message_id,
      });
      await sendTelegramTo("hunting", chat.id, reply, message.message_thread_id ?? null);
      return;
    }
    if (command === "podpiska") {
      if (!isPrivate || !message?.from) {
        const username = await getBotUsername();
        await sendTelegramTo(
          "hunting",
          chat.id,
          `Подписка на новости — в личке бота: ${username ? `https://t.me/${username}` : "напишите боту напрямую"}`,
          message?.message_thread_id ?? null,
        );
        return;
      }
      await callTelegramApi("hunting", "sendMessage", {
        chat_id: chat.id,
        text: SUBSCRIPTION_TEXT,
        reply_markup: await subscriptionKeyboard(String(message.from.id)),
      });
      return;
    }
    if (command === "myid" && message?.from) {
      await sendTelegramTo("hunting", chat.id, `Ваш Telegram id: ${message.from.id}`, message.message_thread_id ?? null);
      return;
    }
    if (command === "sbor") {
      reply = isPrivate
        ? `Сбор работает в охотничьей группе — отправьте команду там.\n\n${GATHERING_USAGE}`
        : await createGathering({
            chatId: chat.id,
            threadId: message?.message_thread_id ?? null,
            from: message?.from,
            arg: rest.join(" "),
            today: (await getHuntingOverview()).today,
          });
      if (reply) {
        await sendTelegramTo("hunting", chat.id, reply, message?.message_thread_id ?? null);
      }
      return;
    }
    if (command === "dokument" || command === "dokumenty") {
      if (!isPrivate) {
        const username = await getBotUsername();
        reply = `Сроки документов — только в личке, чтобы даты не светились в чате: ${
          username ? `https://t.me/${username}` : "напишите боту напрямую"
        }`;
      } else if (message?.from) {
        const userId = String(message.from.id);
        const today = (await getHuntingOverview()).today;
        await reactivateDocuments(userId);
        reply =
          command === "dokumenty" && rest.length === 0
            ? await listDocumentsText(userId, today)
            : await handleDocumentCommand({ id: userId, name: userName(message.from) }, rest.join(" "), today);
      } else {
        reply = DOCUMENTS_USAGE;
      }
      await sendTelegramTo("hunting", chat.id, reply, message?.message_thread_id ?? null);
      return;
    }
    if (command === "start" && isPrivate && message?.from) {
      await reactivateDocuments(String(message.from.id));
    }
    reply = await buildHuntingReply(command, rest.join(" "));
    html = HTML_REPLIES.has(command) && reply != null;
    if (!reply && isPrivate) {
      reply = helpText();
    }
  } else {
    const username = await getBotUsername();
    const addressed =
      isPrivate ||
      (username != null &&
        (text.toLowerCase().includes(`@${username}`) ||
          message?.reply_to_message?.from?.username?.toLowerCase() === username));
    const question = username ? text.replace(new RegExp(`@${username}\\b`, "gi"), "").trim() : text;
    const useChat = addressed && question !== "" && message?.from != null && huntingChatEnabled();
    if (useChat && message?.from) {
      await logBotUsage({ from: message.from, chat, topic: CHAT_TOPIC, text: question });
      await callTelegramApi("hunting", "sendChatAction", {
        chat_id: chat.id,
        action: "typing",
        ...(message.message_thread_id != null ? { message_thread_id: message.message_thread_id } : {}),
      });
      reply = await huntingChatReply({
        chatId: String(chat.id),
        userId: String(message.from.id),
        name: userName(message.from),
        text: question,
        isGroup: !isPrivate,
        unlimited: String(message.from.id) === huntingAdminId(),
        tools: CHAT_TOOLS,
      }).catch((error) => {
        console.error("hunting chat", error);
        return null;
      });
    }
    if (!reply && isPrivate) {
      if (!useChat) {
        await logBotUsage({ from: message?.from, chat, topic: textTopic(text), text });
      }
      ({ reply, html } = await keywordReply(text));
    }
  }

  if (reply) {
    await sendTelegramTo("hunting", chat.id, reply, message?.message_thread_id ?? null, { html });
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
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (!webhook.ok) {
    return { ok: false, error: `setWebhook: ${webhook.error}` };
  }
  const commands = [
    ...BASE_COMMANDS,
    ...LAW_COMMANDS,
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
    .flatMap((order) => order.entries.map((entry) => ({ ...entry, orderTopic: order.topic })))
    .filter((entry) => {
      const key = `${entry.label}|${entry.start}|${entry.end}`;
      if (entry.scope === "excluded" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  type Kind = "soon" | "open" | "close";
  const yesterday = dayBefore(overview.today);
  const due: { kind: Kind; key: string; entry: (typeof entries)[number] }[] = [];
  for (const entry of entries) {
    const id = `${entry.label}|${entry.start}|${entry.end}`;
    if (entry.status === "upcoming" && entry.days <= REMIND_DAYS_BEFORE) {
      due.push({ kind: "soon", key: `soon:${id}`, entry });
    }
    if (entry.status === "open" && entry.start >= yesterday) {
      due.push({ kind: "open", key: `open:${id}`, entry });
    }
    if (entry.status === "open" && entry.days <= REMIND_DAYS_BEFORE && entry.start < yesterday) {
      due.push({ kind: "close", key: `close:${id}`, entry });
    }
  }

  const sent = await alreadySent(due.map((item) => item.key));
  const fresh = due.filter((item) => !sent.has(item.key));
  if (fresh.length === 0) {
    return;
  }

  const sections: { kind: Kind; title: string; mode: "from" | "until" }[] = [
    { kind: "soon", title: "⏳ <b>СКОРО ОТКРЫВАЕТСЯ</b>", mode: "from" },
    { kind: "open", title: "🟢 <b>ОТКРЫЛАСЬ</b>", mode: "until" },
    { kind: "close", title: "⌛ <b>СКОРО ЗАКРЫВАЕТСЯ</b>", mode: "until" },
  ];
  const lines = ["🔔 <b>Охота в Шатуре — напоминание</b>"];
  for (const section of sections) {
    const items = fresh.filter((item) => item.kind === section.kind).map((item) => item.entry);
    if (items.length > 0) {
      lines.push("", section.title, ...renderHuntItems(toHuntItems(items), section.mode, overview.today));
    }
  }
  lines.push("", "ℹ️ Цены — /ceny · егеря — /kontakty");

  const result = await sendTelegramMessage(lines.join("\n"), "hunting", { html: true });
  if (result.ok) {
    await markSent(fresh.map((group) => group.key));
  }
}

async function sendGatheringReminders(today: string, hour: number) {
  if (hour < GATHERING_REMIND_HOUR) {
    return;
  }
  for (const gathering of await gatheringsForTomorrow(today)) {
    const key = `sbor:${gathering.id}`;
    if ((await alreadySent([key])).size > 0) {
      continue;
    }
    const result = await callTelegramApi("hunting", "sendMessage", {
      chat_id: gathering.chatId,
      text: await buildGatheringReminder(gathering),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(gathering.messageId ? { reply_parameters: { message_id: gathering.messageId, allow_sending_without_reply: true } } : {}),
      ...(gathering.threadId != null ? { message_thread_id: gathering.threadId } : {}),
    });
    if (result.ok) {
      await markSent([key]);
    }
  }
}

/** Четверг — погода на субботу и воскресенье в те чаты, где на выходные назначен сбор. */
async function sendWeekendWeather(now: Date, today: string, hour: number) {
  if (moscowWeekday(now) !== 4 || hour < WEEKEND_WEATHER_HOUR) {
    return;
  }
  const weekend = [addDays(today, 2), addDays(today, 3)];
  const gatherings = await gatheringsOn(weekend);
  const chats = new Map<string, (typeof gatherings)[number]>();
  for (const gathering of gatherings) {
    if (!chats.has(gathering.chatId)) {
      chats.set(gathering.chatId, gathering);
    }
  }
  if (chats.size === 0) {
    return;
  }
  let days: Awaited<ReturnType<typeof fetchHuntingWeather>> | null = null;
  for (const [chatId, gathering] of chats) {
    const key = `weekend:${chatId}:${today}`;
    if ((await alreadySent([key])).size > 0) {
      continue;
    }
    days ??= (await fetchHuntingWeather(4).catch(() => [])).filter((day) => weekend.includes(day.date));
    if (days.length === 0) {
      return;
    }
    const result = await callTelegramApi("hunting", "sendMessage", {
      chat_id: chatId,
      text: buildWeatherHtml(days, "Погода на выходные — Шатура"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(gathering.threadId != null ? { message_thread_id: gathering.threadId } : {}),
    });
    if (result.ok) {
      await markSent([key]);
    }
  }
}

async function sendLawsInForce(today: string) {
  const items = lawsInForceOn(await getLawStates(), today);
  if (items.length === 0) {
    return;
  }
  const key = `law-force:${today}`;
  if ((await alreadySent([key])).size > 0) {
    return;
  }
  const result = await sendTelegramMessage(buildLawsInForceHtml(items), "hunting", { html: true });
  if (result.ok) {
    await markSent([key]);
  }
}

/** С какого часа (МСК) в воскресенье публиковать итоги недели. */
const WEEKLY_HOUR = 18;
/** Прогноз непогоды и пожароопасность — не чаще, чем раз в столько часов. */
const SIGNALS_EVERY_HOURS = 3;
/** Повторять тревогу о высокой пожароопасности того же класса — не чаще раза в неделю. */
const FIRE_ALERT_REPEAT_HOURS = 7 * 24;
const FIRE_ALERT_LEVEL = 4;

/** Непогода на сегодня-завтра и высокая пожароопасность — в охотничий чат, каждое предупреждение один раз. */
async function sendSignalAlerts(now: Date) {
  if (await recentlyDone("fetch:signals", SIGNALS_EVERY_HOURS, now)) {
    return;
  }
  await markDone("fetch:signals", now);
  const signals = await fetchSeasonSignals().catch((error) => {
    console.error("hunting signals", error);
    return null;
  });
  if (!signals) {
    return;
  }
  const storms = stormWarnings(signals);
  const sent = await alreadySent(storms.map((item) => `storm:${item.date}:${item.kind}`));
  const fresh = storms.filter((item) => !sent.has(`storm:${item.date}:${item.kind}`));
  if (fresh.length > 0) {
    const result = await sendTelegramMessage(stormWarningsHtml(fresh), "hunting", { html: true });
    if (result.ok) {
      await markSent(fresh.map((item) => `storm:${item.date}:${item.kind}`));
    }
  }
  const danger = fireDanger(signals);
  const key = `fire-alert:${danger.level}`;
  if (!danger.snow && danger.level >= FIRE_ALERT_LEVEL && !(await recentlyDone(key, FIRE_ALERT_REPEAT_HOURS, now))) {
    const result = await sendTelegramMessage(
      [
        "🔥 <b>Высокая пожароопасность в лесах Шатуры</b>",
        "",
        escapeHtml(fireDangerLine(danger)),
        "Костры, окурки и пыжи — главная причина лесных пожаров. При IV–V классе лесничество может закрыть въезд в лес.",
        "",
        "<i>Расчёт по погоде (Open-Meteo); официальные запреты бот присылает отдельно.</i>",
      ].join("\n"),
      "hunting",
      { html: true },
    );
    if (result.ok) {
      await markDone(key, now);
    }
  }
}

/** Воскресенье вечером — итоги недели: новости по рубрикам, грибы, пожароопасность, непогода. */
async function sendWeeklyDigest(now: Date, today: string, hour: number) {
  if (moscowWeekday(now) !== 0 || hour < WEEKLY_HOUR) {
    return;
  }
  const key = `weekly:${today}`;
  if ((await alreadySent([key])).size > 0) {
    return;
  }
  const [news, signals, mushroomPosts] = await Promise.all([
    weeklyNewsLines(now),
    fetchSeasonSignals().catch(() => null),
    weeklyMushroomPosts(now).catch(() => 0),
  ]);
  const season = seasonLines(signals, mushroomPosts);
  const html = [
    "📋 <b>Неделя в лесах Шатуры</b>",
    "",
    ...news,
    ...(season.length > 0 ? ["", ...season] : []),
    "",
    "Новости в личку по темам — /podpiska · погода — /pogoda",
  ].join("\n");
  const result = await sendTelegramMessage(html, "hunting", { html: true });
  if (result.ok) {
    await markSent([key]);
  }
}

/** Первого числа — модератору слова, которые стоит добавить в шум. */
async function sendMonthlyNoise(today: string, hour: number) {
  if (!today.endsWith("-01") || hour < 10) {
    return;
  }
  const key = `noise-suggest:${today.slice(0, 7)}`;
  if ((await alreadySent([key])).size > 0) {
    return;
  }
  await sendNoiseSuggestions().catch((error) => console.error("hunting noise suggestions", error));
  await markSent([key]);
}

async function recentlyDone(key: string, hours: number, now: Date): Promise<boolean> {
  const row = await prisma.huntingNotice.findUnique({ where: { key } });
  return Boolean(row && now.getTime() - row.sentAt.getTime() < hours * 3_600_000);
}

async function markDone(key: string, now: Date) {
  await prisma.huntingNotice.upsert({ where: { key }, create: { key, sentAt: now }, update: { sentAt: now } });
}

/** Вёрстка mooir.ru поменялась, а ошибок нет: распоряжение без сроков, пропали цены или контакты. */
async function parseProblems(): Promise<string[]> {
  const overview = await getHuntingOverview();
  const problems = overview.orders
    .filter((order) => order.entries.length === 0)
    .map((order) => `${order.title}: сроки не разобраны`);
  if (!overview.prices?.rows.length) problems.push("прейскурант не разобран");
  if (!overview.contacts?.lines.length) problems.push("контакты Шатурского хозяйства не найдены");
  return problems;
}

/** Один проход расписания: сверка с МООиР, законами, карантинами и лесами; напоминания, прогноз на выходные. */
export async function runHuntingSchedule(now = new Date()): Promise<void> {
  const lastFetch = await getHuntingLastFetch();
  if (!lastFetch || now.getTime() - lastFetch.getTime() > SCHEDULE_COLLECT_HOURS * 3_600_000) {
    const errors = await collectHunting().then(
      async (result) => [...result.errors, ...(result.ok ? [] : ["с mooir.ru ничего не получено"]), ...(await parseProblems())],
      (error) => [error instanceof Error ? error.message : "ошибка"],
    );
    await trackSourceHealth("mooir", "распоряжения МООиР", errors).catch((error) => console.error("hunting health", error));
  }
  if (isLawsStale(await getLawsLastFetch())) {
    const errors = await collectLaws().then(
      (result) => result.errors,
      (error) => [error instanceof Error ? error.message : "ошибка"],
    );
    await trackSourceHealth("laws", "законы (КонсультантПлюс)", errors).catch((error) => console.error("laws health", error));
  }

  if (!getTelegramChannelConfig("hunting").configured) {
    return;
  }
  const hour = Number(formatMoscow(now, { hour: "2-digit", hourCycle: "h23" }));
  if (hour < SEND_FROM_HOUR || hour >= SEND_TO_HOUR) {
    return;
  }

  if (!(await recentlyDone("fetch:alerts", ALERTS_EVERY_HOURS, now))) {
    const errors = await collectAlerts().then(
      (result) => result.errors,
      (error) => [error instanceof Error ? error.message : "ошибка"],
    );
    await markDone("fetch:alerts", now);
    await trackSourceHealth("alerts", "карантины и запреты на посещение лесов", errors).catch((error) =>
      console.error("alerts health", error),
    );
  }
  if (!(await recentlyDone("fetch:incidents", INCIDENTS_EVERY_HOURS, now))) {
    const errors = await collectIncidents(now).then(
      (result) => result.errors,
      (error) => [error instanceof Error ? error.message : "ошибка"],
    );
    await markDone("fetch:incidents", now);
    await trackSourceHealth("incidents", "местные каналы (происшествия)", errors).catch((error) =>
      console.error("incidents health", error),
    );
  }

  const overview = await getHuntingOverview();
  await sendReminders(overview);
  await sendLawsInForce(overview.today);
  await sendGatheringReminders(overview.today, hour);
  await sendDocumentReminders(overview.today, hour).catch((error) => console.error("hunting documents", error));
  await pruneBotUsage(now).catch((error) => console.error("hunting usage prune", error));
  await pruneHuntingChat(now).catch((error) => console.error("hunting chat prune", error));
  await sendWeekendWeather(now, overview.today, hour);
  await sendSignalAlerts(now).catch((error) => console.error("hunting signal alerts", error));
  await sendWeeklyDigest(now, overview.today, hour).catch((error) => console.error("hunting weekly", error));
  await sendMonthlyNoise(overview.today, hour);
}