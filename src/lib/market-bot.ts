import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/calculations";
import { hasListPrice } from "@/lib/pricing";
import {
  callTelegramApi,
  getPublicSiteUrl,
  getTelegramChannelConfig,
  sendTelegramPhoto,
  sendTelegramTo,
} from "@/lib/telegram";

const MAX_PHOTOS = 25;
const SEND_GAP_MS = 350;

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  message_thread_id?: number;
  from?: { id: number; is_bot?: boolean };
};

export type MarketTelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const busyChats = new Set<string>();

const HELP = [
  "ShapeCraft Market — прайс с фото",
  "",
  "/price — весь прайс (в наличии, с ценой)",
  "/price кот — позиции, где в названии есть «кот»",
  "",
  "То же на русском: /прайс и /прайс кот",
  "",
  "Витрина: " + getPublicSiteUrl(),
].join("\n");

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Разбор /price, /прайс и /start|/help (с @ботом и запросом). */
export function parseMarketCommand(
  text: string,
): { kind: "help" } | { kind: "price"; query: string } | null {
  const raw = text.trim();
  if (!raw.startsWith("/")) {
    return null;
  }
  const match = raw.match(
    /^\/(start|help|price|прайс)(?:@([A-Za-z0-9_]+))?(?:\s+(.+))?$/iu,
  );
  if (!match) {
    return null;
  }
  const command = match[1].toLowerCase();
  if (command === "start" || command === "help") {
    return { kind: "help" };
  }
  return { kind: "price", query: (match[3] ?? "").trim() };
}

function productMatches(name: string, query: string): boolean {
  if (!query) {
    return true;
  }
  return name.toLowerCase().includes(query.toLowerCase());
}

function priceCaption(product: {
  name: string;
  listPrice: number;
  stock: number;
}): string {
  return [
    product.name.trim(),
    `Цена: ${formatRub(product.listPrice)}`,
    `В наличии: ${product.stock} шт`,
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

  return rows
    .filter((row) => hasListPrice(row.listPrice) && productMatches(row.name, query))
    .map((row) => ({
      id: row.id,
      name: row.name,
      listPrice: row.listPrice as number,
      stock: row.stock,
      imageUrl: row.imageUrl,
    }));
}

async function sendPriceList(
  chatId: number,
  threadId: number | null,
  query: string,
): Promise<void> {
  const key = `${chatId}:${threadId ?? 0}`;
  if (busyChats.has(key)) {
    await sendTelegramTo(
      "market",
      chatId,
      "Уже собираю прайс — подождите немного.",
      threadId,
    );
    return;
  }

  busyChats.add(key);
  try {
    const products = await loadPricedProducts(query);
    if (products.length === 0) {
      await sendTelegramTo(
        "market",
        chatId,
        query
          ? `Ничего не нашёл по «${query}». Попробуйте другое слово или /price без фильтра.`
          : "В прайсе пока нет товаров с ценой и остатком.",
        threadId,
      );
      return;
    }

    const shown = products.slice(0, MAX_PHOTOS);
    const header = query
      ? `Прайс по «${query}»: ${products.length} шт.`
      : `Прайс ShapeCraft: ${products.length} шт.`;
    const note =
      products.length > MAX_PHOTOS
        ? `\nПоказываю первые ${MAX_PHOTOS}. Уточните, например: /price кот`
        : "";
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

  const parsed = parseMarketCommand(message.text);
  if (!parsed) {
    return;
  }

  const chatId = message.chat.id;
  const threadId =
    typeof message.message_thread_id === "number" ? message.message_thread_id : null;

  if (parsed.kind === "help") {
    await sendTelegramTo("market", chatId, HELP, threadId);
    return;
  }

  await sendPriceList(chatId, threadId, parsed.query);
}

/** Меню команд бота + снятие webhook (сообщения забирает long polling). */
export async function connectMarketBot(): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  const { token } = getTelegramChannelConfig("market");
  if (!token) {
    return { ok: false, error: "TELEGRAM_MARKET_BOT_TOKEN не задан" };
  }

  const webhook = await callTelegramApi("market", "deleteWebhook", {
    drop_pending_updates: false,
  });
  if (!webhook.ok) {
    return { ok: false, error: `deleteWebhook: ${webhook.error}` };
  }

  const menu = await callTelegramApi("market", "setMyCommands", {
    commands: [
      { command: "price", description: "Прайс с фото (или /price кот)" },
      { command: "help", description: "Как пользоваться" },
    ],
  });
  if (!menu.ok) {
    return { ok: false, error: `setMyCommands: ${menu.error}` };
  }

  const me = await callTelegramApi<{ username?: string }>("market", "getMe");
  return { ok: true, username: me.result?.username };
}
