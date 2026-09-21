import dns from "node:dns";
import { readFile } from "fs/promises";
import path from "path";
import { getUploadsDir, getMimeType } from "@/lib/upload";

dns.setDefaultResultOrder("ipv4first");

export type TelegramSendResult = {
  ok: boolean;
  configured: boolean;
  status?: number;
  error?: string;
};

function cleanEnv(value: string | undefined): string {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function toChatId(value: string): string | number {
  if (/^-?\d+$/.test(value)) {
    const asNum = Number(value);
    if (Number.isSafeInteger(asNum)) {
      return asNum;
    }
  }
  return value;
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "network error";
  }
  if (error.name === "AbortError") {
    return "timeout: Telegram не ответил за 12с";
  }
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message) {
    return `${error.message}: ${cause.message}`;
  }
  return error.message;
}

export type TelegramChannel = "ops" | "market";

export type TelegramChannelConfig = {
  channel: TelegramChannel;
  token: string;
  chatId: string;
  /** Топик форума (для ссылок вида t.me/c/.../26) */
  threadId: number | null;
  configured: boolean;
  siteUrl: string;
  label: string;
};

export function getPublicSiteUrl(): string {
  return (
    cleanEnv(process.env.PUBLIC_SITE_URL) || "https://shapecraft.ru"
  ).replace(/\/$/, "");
}

function parseThreadId(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** ops — служебные пуши; market — отдельный бот для объявлений / рабочей группы. */
export function getTelegramChannelConfig(
  channel: TelegramChannel = "ops",
): TelegramChannelConfig {
  const siteUrl = getPublicSiteUrl();

  if (channel === "market") {
    const token = cleanEnv(process.env.TELEGRAM_MARKET_BOT_TOKEN);
    const chatId = cleanEnv(process.env.TELEGRAM_MARKET_CHAT_ID);
    const threadId = parseThreadId(
      cleanEnv(process.env.TELEGRAM_MARKET_THREAD_ID),
    );
    return {
      channel,
      token,
      chatId,
      threadId,
      configured: Boolean(token && chatId),
      siteUrl,
      label: "Маркет / объявления",
    };
  }

  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);
  return {
    channel: "ops",
    token,
    chatId,
    threadId: null,
    configured: Boolean(token && chatId),
    siteUrl,
    label: "Служебный (клики / склад)",
  };
}

/** @deprecated используйте getTelegramChannelConfig("ops") */
export function getTelegramConfig(): {
  token: string;
  chatId: string;
  configured: boolean;
  siteUrl: string;
} {
  const config = getTelegramChannelConfig("ops");
  return {
    token: config.token,
    chatId: config.chatId,
    configured: config.configured,
    siteUrl: config.siteUrl,
  };
}

/** Абсолютный URL картинки для Telegram (публичный). */
export function resolveProductImageUrl(
  imageUrl: string | null | undefined,
): string | null {
  if (!imageUrl?.trim()) {
    return null;
  }
  const raw = imageUrl.trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const { siteUrl } = getTelegramChannelConfig("ops");
  return `${siteUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function localUploadPath(imageUrl: string): string | null {
  const match = imageUrl.match(/\/api\/media\/([^/?#]+)/i);
  if (!match?.[1]) {
    return null;
  }
  const safe = path.basename(match[1]);
  if (!safe || safe !== match[1]) {
    return null;
  }
  return path.join(getUploadsDir(), safe);
}

/**
 * Текст в Telegram.
 */
export async function sendTelegramMessage(
  text: string,
  channel: TelegramChannel = "ops",
): Promise<TelegramSendResult> {
  const { token, chatId, configured, label, threadId } =
    getTelegramChannelConfig(channel);

  if (!configured) {
    return {
      ok: false,
      configured: false,
      error:
        channel === "market"
          ? "TELEGRAM_MARKET_BOT_TOKEN или TELEGRAM_MARKET_CHAT_ID не заданы"
          : "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы в контейнере",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: toChatId(chatId),
          text: text.slice(0, 4000),
          disable_web_page_preview: true,
          ...(threadId != null ? { message_thread_id: threadId } : {}),
        }),
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timer));

    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!response.ok || !body?.ok) {
      const error = body?.description || `Telegram HTTP ${response.status}`;
      console.error("telegram send failed", {
        channel,
        label,
        error,
        chatId,
        status: response.status,
      });
      return {
        ok: false,
        configured: true,
        status: response.status,
        error,
      };
    }

    return { ok: true, configured: true, status: response.status };
  } catch (error) {
    const message = formatFetchError(error);
    console.error("telegram send exception", { channel, message });
    return { ok: false, configured: true, error: message };
  }
}

/**
 * Фото + подпись. Сначала публичный URL, иначе multipart с диска.
 * Если фото нет или не отправилось — уходит только текст.
 */
export async function sendTelegramPhoto(input: {
  caption: string;
  imageUrl?: string | null;
  channel?: TelegramChannel;
}): Promise<TelegramSendResult> {
  const channel = input.channel ?? "ops";
  const { token, chatId, configured, threadId } =
    getTelegramChannelConfig(channel);
  const caption = input.caption.slice(0, 1024);

  if (!configured) {
    return {
      ok: false,
      configured: false,
      error:
        channel === "market"
          ? "TELEGRAM_MARKET_BOT_TOKEN или TELEGRAM_MARKET_CHAT_ID не заданы"
          : "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы в контейнере",
    };
  }

  const publicUrl = resolveProductImageUrl(input.imageUrl);
  if (!publicUrl && !input.imageUrl) {
    return sendTelegramMessage(input.caption, channel);
  }

  // 1) URL (Telegram сам скачает)
  if (publicUrl) {
    const byUrl = await sendPhotoJson(
      token,
      chatId,
      publicUrl,
      caption,
      threadId,
    );
    if (byUrl.ok) {
      return byUrl;
    }
    console.error("telegram photo by url failed", byUrl.error);
  }

  // 2) файл с диска
  if (input.imageUrl) {
    const filePath = localUploadPath(input.imageUrl);
    if (filePath) {
      try {
        const buffer = await readFile(filePath);
        const byFile = await sendPhotoMultipart(
          token,
          chatId,
          buffer,
          path.basename(filePath),
          caption,
          threadId,
        );
        if (byFile.ok) {
          return byFile;
        }
        console.error("telegram photo by file failed", byFile.error);
      } catch (error) {
        console.error("telegram photo read failed", formatFetchError(error));
      }
    }
  }

  // 3) хотя бы текст
  return sendTelegramMessage(input.caption, channel);
}

async function sendPhotoJson(
  token: string,
  chatId: string,
  photoUrl: string,
  caption: string,
  threadId: number | null = null,
): Promise<TelegramSendResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: toChatId(chatId),
          photo: photoUrl,
          caption,
          ...(threadId != null ? { message_thread_id: threadId } : {}),
        }),
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timer));

    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        configured: true,
        status: response.status,
        error: body?.description || `Telegram HTTP ${response.status}`,
      };
    }
    return { ok: true, configured: true, status: response.status };
  } catch (error) {
    return { ok: false, configured: true, error: formatFetchError(error) };
  }
}

async function sendPhotoMultipart(
  token: string,
  chatId: string,
  buffer: Buffer,
  filename: string,
  caption: string,
  threadId: number | null = null,
): Promise<TelegramSendResult> {
  try {
    const form = new FormData();
    form.set("chat_id", String(toChatId(chatId)));
    form.set("caption", caption);
    if (threadId != null) {
      form.set("message_thread_id", String(threadId));
    }
    const ext = path.extname(filename) || ".jpg";
    const blob = new Blob([new Uint8Array(buffer)], {
      type: getMimeType(ext),
    });
    form.set("photo", blob, filename);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      {
        method: "POST",
        body: form,
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timer));

    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        configured: true,
        status: response.status,
        error: body?.description || `Telegram HTTP ${response.status}`,
      };
    }
    return { ok: true, configured: true, status: response.status };
  } catch (error) {
    return { ok: false, configured: true, error: formatFetchError(error) };
  }
}

function fireAndForget(result: Promise<TelegramSendResult>, label: string) {
  void result.then((value) => {
    if (!value.ok) {
      console.error(`telegram ${label}`, value.error ?? "failed");
    }
  });
}

export function notifyTelegramNewProduct(product: {
  name: string;
  imageUrl?: string | null;
  listPrice?: number | null;
  stock?: number;
  catalogLine?: string;
}) {
  const line =
    product.catalogLine === "home" ? "Для дома" : "Сувениры";
  const price =
    product.listPrice != null && Number.isFinite(product.listPrice)
      ? `${Math.round(product.listPrice)} ₽`
      : "цена не задана";
  const stock =
    product.stock != null ? `${product.stock} шт` : "—";

  fireAndForget(
    sendTelegramPhoto({
      imageUrl: product.imageUrl,
      caption: [
        "🆕 Новый товар",
        product.name,
        `Направление: ${line}`,
        `Прайс: ${price}`,
        `Остаток: ${stock}`,
      ].join("\n"),
    }),
    "new-product",
  );
}

export function notifyTelegramReceipt(input: {
  name: string;
  imageUrl?: string | null;
  quantity: number;
  stockAfter: number;
  note?: string | null;
}) {
  fireAndForget(
    sendTelegramPhoto({
      imageUrl: input.imageUrl,
      caption: [
        "📦 Новая поставка",
        input.name,
        `Приход: +${input.quantity} шт`,
        `Остаток теперь: ${input.stockAfter} шт`,
        input.note?.trim() ? `Заметка: ${input.note.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    "receipt",
  );
}

export function notifyTelegramSale(input: {
  name: string;
  imageUrl?: string | null;
  quantity: number;
  amount: number;
  stockAfter?: number;
  note?: string | null;
}) {
  fireAndForget(
    sendTelegramPhoto({
      imageUrl: input.imageUrl,
      caption: [
        "💰 Новая продажа",
        input.name,
        `Кол-во: ${input.quantity} шт`,
        `Сумма: ${Math.round(input.amount)} ₽`,
        input.stockAfter != null ? `Остаток: ${input.stockAfter} шт` : null,
        input.note?.trim() ? `Заметка: ${input.note.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    "sale",
  );
}

/** Ручная публикация объявления маркет-ботом (kupipro77 / рабочая группа). */
export function buildMarketListingCaption(product: {
  name: string;
  description?: string | null;
  listPrice: number;
  stock?: number | null;
}): string {
  const siteUrl = getPublicSiteUrl();
  const price = `${Math.round(product.listPrice).toLocaleString("ru-RU")} ₽`;
  const desc = product.description?.trim();
  const descLine =
    desc && desc.length > 280 ? `${desc.slice(0, 277).trimEnd()}…` : desc;

  return [
    product.name.trim(),
    `Цена: ${price}`,
    descLine || null,
    product.stock != null ? `В наличии: ${product.stock} шт` : null,
    "",
    "Информация о способах приобретения доступна на витрине:",
    siteUrl,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function publishProductToMarketChat(product: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  listPrice: number;
  stock?: number | null;
}): Promise<TelegramSendResult> {
  return sendTelegramPhoto({
    channel: "market",
    imageUrl: product.imageUrl,
    caption: buildMarketListingCaption(product),
  });
}
