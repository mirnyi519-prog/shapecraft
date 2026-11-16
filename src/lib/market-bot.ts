import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/calculations";
import { logBotUsage, saveBotReply } from "@/lib/hunting-usage";
import type { TelegramUser } from "@/lib/hunting-gathering";
import { hasListPrice } from "@/lib/pricing";
import {
  callTelegramApi,
  getPublicSiteUrl,
  getTelegramChannelConfig,
  sendTelegramPhoto,
  sendTelegramTo,
} from "@/lib/telegram";

/** Защита от флуда Telegram, если совпадений очень много. */
const MAX_PHOTOS = 40;
const SEND_GAP_MS = 350;
const HINT_COUNT = 8;

type MessageEntity = {
  type: string;
  offset: number;
  length: number;
  user?: { id: number; is_bot?: boolean; username?: string };
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  entities?: MessageEntity[];
  chat: { id: number; type?: string; title?: string };
  message_thread_id?: number;
  from?: TelegramUser & { is_bot?: boolean };
};

export type MarketTelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const busyChats = new Set<string>();
let cachedUsername: string | null = null;
let cachedBotId: number | null = null;

const FILLER_WORD =
  /^(?:покажи|покажите|дай|дайте|найди|найдите|ищи|поиск|нужен|нужна|нужно|цены|цену|цена|прайс|прайсы|пожалуйста|плиз|pls|please|мне|нам|все|весь|вся|по|про)\s+/iu;

const STOP_WORDS = new Set([
  "и",
  "в",
  "на",
  "с",
  "из",
  "для",
  "по",
  "или",
  "the",
  "a",
  "of",
  "шт",
  "мм",
  "см",
]);

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getMarketBotUsername(): Promise<string | null> {
  if (cachedUsername) {
    return cachedUsername;
  }
  const me = await callTelegramApi<{ id?: number; username?: string }>("market", "getMe");
  cachedUsername = me.result?.username?.toLowerCase() ?? null;
  cachedBotId = typeof me.result?.id === "number" ? me.result.id : null;
  return cachedUsername;
}

function helpText(username: string | null): string {
  const tag = username ? `@${username}` : "@бот";
  return [
    "ShapeCraft Market — прайс с фото",
    "",
    "Обратитесь к боту и укажите, что искать в названии:",
    `${tag}: кот`,
    `${tag}: покажи цены кот`,
    "",
    "Ответ — только позиции, где в названии есть это слово (как %кот%).",
    "",
    "Витрина: " + getPublicSiteUrl(),
  ].join("\n");
}

/** Убирает «покажи цены» и т.п., оставляет ключевое слово для поиска. */
export function cleanMarketQuery(raw: string): string {
  let q = raw.replace(/^[:\-–,.;]+\s*/u, "").trim();
  for (let i = 0; i < 10; i += 1) {
    const next = q.replace(FILLER_WORD, "").trim();
    if (next === q) {
      break;
    }
    q = next;
  }
  return q.replace(/\s+/g, " ").trim();
}

/**
 * Текст после обращения к боту.
 * Срабатывает на entity mention / text_mention или на явный @username в тексте.
 */
export function extractMentionQuery(
  text: string,
  username: string | null,
  botId: number | null,
  entities: MessageEntity[] | undefined,
): string | null {
  const normalizedUser = username?.toLowerCase() ?? null;

  if (entities?.length && text) {
    for (const entity of entities) {
      if (entity.type === "mention" && normalizedUser) {
        const slice = text.slice(entity.offset, entity.offset + entity.length);
        if (slice.replace(/^@/, "").toLowerCase() === normalizedUser) {
          return text.slice(entity.offset + entity.length);
        }
      }
      if (
        entity.type === "text_mention" &&
        botId != null &&
        entity.user?.is_bot &&
        entity.user.id === botId
      ) {
        return text.slice(entity.offset + entity.length);
      }
    }
  }

  if (normalizedUser) {
    const re = new RegExp(`@${normalizedUser}\\b`, "i");
    const match = re.exec(text);
    if (match && match.index != null) {
      return text.slice(match.index + match[0].length);
    }
  }

  return null;
}

export function parseMarketMessage(
  text: string,
  username: string | null,
  botId: number | null,
  entities?: MessageEntity[],
): { kind: "help" } | { kind: "price"; query: string } | { kind: "need_query" } | null {
  const raw = text.trim();
  if (!raw) {
    return null;
  }

  const command = raw.match(/^\/(start|help)(?:@([A-Za-z0-9_]+))?\s*$/iu);
  if (command) {
    const mention = command[2]?.toLowerCase();
    if (mention && username && mention !== username) {
      return null;
    }
    return { kind: "help" };
  }

  const afterMention = extractMentionQuery(raw, username, botId, entities);
  if (afterMention == null) {
    return null;
  }

  const query = cleanMarketQuery(afterMention);
  if (!query) {
    return { kind: "need_query" };
  }
  return { kind: "price", query };
}

function productMatches(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

function priceCaption(product: {
  id: string;
  name: string;
  listPrice: number;
  stock: number;
}): string {
  const siteUrl = getPublicSiteUrl();
  return [
    product.name.trim(),
    `Цена: ${formatRub(product.listPrice)}`,
    `В наличии: ${product.stock} шт`,
    "",
    `${siteUrl}/products/${product.id}`,
  ].join("\n");
}

async function loadPricedProducts(query: string) {
  const rows = await prisma.product.findMany({
    where: {
      active: true,
      listPrice: { not: null },
      stock: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      listPrice: true,
      stock: true,
      imageUrl: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const needle = query.toLowerCase();
  return rows
    .filter(
      (row) => hasListPrice(row.listPrice) && productMatches(row.name, needle),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      listPrice: row.listPrice as number,
      stock: row.stock,
      imageUrl: row.imageUrl,
    }));
}

/** Частые короткие слова из названий — подсказки, когда поиск пустой. */
async function popularNameHints(limit = HINT_COUNT): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, listPrice: { not: null }, stock: { gt: 0 } },
    select: { name: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const tokens = row.name
      .toLowerCase()
      .split(/[^0-9a-zа-яё]+/iu)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .slice(0, limit)
    .map(([token]) => token);
}

async function missMessage(query: string, username: string | null): Promise<string> {
  const tag = username ? `@${username}` : "@бот";
  const hints = await popularNameHints();
  const lines = [
    `Ничего не нашёл с «${query}» в названии.`,
  ];
  if (hints.length > 0) {
    lines.push("", "Попробуйте, например:");
    for (const hint of hints) {
      lines.push(`${tag}: ${hint}`);
    }
  } else {
    lines.push("Попробуйте другое слово.");
  }
  return lines.join("\n");
}

async function sendPriceList(input: {
  chatId: number;
  threadId: number | null;
  query: string;
  username: string | null;
  from?: TelegramUser;
  chat: { id: number; type?: string; title?: string };
}): Promise<void> {
  const { chatId, threadId, query, username, from, chat } = input;
  const key = `${chatId}:${threadId ?? 0}`;
  if (busyChats.has(key)) {
    await sendTelegramTo(
      "market",
      chatId,
      "Уже ищу по прайсу — подождите немного.",
      threadId,
    );
    return;
  }

  busyChats.add(key);
  try {
    const products = await loadPricedProducts(query);
    if (products.length === 0) {
      const reply = await missMessage(query, username);
      const eventId = await logBotUsage({
        bot: "market",
        from,
        chat,
        topic: {
          section: "Прайс",
          topic: "miss",
          title: `Нет: ${query.slice(0, 40)}`,
        },
        text: query,
      });
      await saveBotReply(eventId, reply);
      await sendTelegramTo("market", chatId, reply, threadId);
      return;
    }

    const shown = products.slice(0, MAX_PHOTOS);
    const header = `По «${query}»: ${products.length} шт.`;
    const note =
      products.length > MAX_PHOTOS
        ? `\nПоказываю первые ${MAX_PHOTOS} — уточните запрос.`
        : "";
    const summary = [
      header + note,
      "",
      ...shown.slice(0, 10).map((p) => `• ${p.name} — ${formatRub(p.listPrice)}`),
      shown.length > 10 ? `… и ещё ${shown.length - 10}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const eventId = await logBotUsage({
      bot: "market",
      from,
      chat,
      topic: {
        section: "Прайс",
        topic: "search",
        title: `Поиск: ${query.slice(0, 40)}`,
      },
      text: query,
    });
    await saveBotReply(eventId, summary);

    await sendTelegramTo("market", chatId, header + note, threadId);

    for (const product of shown) {
      await sendTelegramPhoto({
        channel: "market",
        chatId,
        threadId,
        imageUrl: product.imageUrl,
        caption: priceCaption(product),
      });
      await pause(SEND_GAP_MS);
    }
  } finally {
    busyChats.delete(key);
  }
}

export async function handleMarketUpdate(update: MarketTelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text || message.from?.is_bot) {
    return;
  }

  const username = await getMarketBotUsername();
  const parsed = parseMarketMessage(
    message.text,
    username,
    cachedBotId,
    message.entities,
  );
  if (!parsed) {
    return;
  }

  const chatId = message.chat.id;
  const threadId =
    typeof message.message_thread_id === "number" ? message.message_thread_id : null;
  const chat = {
    id: message.chat.id,
    type: message.chat.type,
    title: message.chat.title,
  };
  const from = message.from;

  if (parsed.kind === "help") {
    const reply = helpText(username);
    const eventId = await logBotUsage({
      bot: "market",
      from,
      chat,
      topic: { section: "Справка", topic: "help", title: "Справка" },
      text: "/help",
    });
    await saveBotReply(eventId, reply);
    await sendTelegramTo("market", chatId, reply, threadId);
    return;
  }

  if (parsed.kind === "need_query") {
    const tag = username ? `@${username}` : "@бот";
    const reply = `Напишите, что искать в названии.\nНапример: ${tag}: кот\nили: ${tag}: покажи цены кот`;
    const eventId = await logBotUsage({
      bot: "market",
      from,
      chat,
      topic: { section: "Прайс", topic: "need_query", title: "Пустой запрос" },
      text: message.text.slice(0, 200),
    });
    await saveBotReply(eventId, reply);
    await sendTelegramTo("market", chatId, reply, threadId);
    return;
  }

  await sendPriceList({
    chatId,
    threadId,
    query: parsed.query,
    username,
    from,
    chat,
  });
}

/** Меню + снятие webhook (сообщения забирает long polling). */
export async function connectMarketBot(): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  const { token } = getTelegramChannelConfig("market");
  if (!token) {
    return { ok: false, error: "TELEGRAM_MARKET_BOT_TOKEN не задан" };
  }

  cachedUsername = null;
  cachedBotId = null;

  const webhook = await callTelegramApi("market", "deleteWebhook", {
    drop_pending_updates: false,
  });
  if (!webhook.ok) {
    return { ok: false, error: `deleteWebhook: ${webhook.error}` };
  }

  const menu = await callTelegramApi("market", "setMyCommands", {
    commands: [{ command: "help", description: "Как спросить прайс у бота" }],
  });
  if (!menu.ok) {
    return { ok: false, error: `setMyCommands: ${menu.error}` };
  }

  const botUsername = await getMarketBotUsername();
  return { ok: true, username: botUsername ?? undefined };
}
