import dns from "node:dns";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { readFile } from "fs/promises";
import path from "path";
import { type ProductSpecsInput, telegramSpecLines } from "@/lib/product-specs";
import { getUploadsDir, getMimeType } from "@/lib/upload";

dns.setDefaultResultOrder("ipv4first");

/**
 * С сервера api.telegram.org открыт только по IPv6 (IPv4 заблокирован), а новое соединение
 * изредка не устанавливается вовсе. Поэтому: IPv6 первым, соединения держим открытыми,
 * а несостоявшееся за 3 с соединение пробуем заново.
 */
const CONNECT_TIMEOUT_MS = 3_000;
const CONNECT_ATTEMPTS = 3;
const RETRY_CODES = new Set(["ECONNECT_TIMEOUT", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN"]);

const ipv6First: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error || addresses.length === 0) {
      callback(error ?? new Error(`DNS: ${hostname}`), "", 0);
      return;
    }
    const sorted = [...addresses].sort((a, b) => b.family - a.family);
    if (options.all) {
      callback(null, sorted);
    } else {
      callback(null, sorted[0].address, sorted[0].family);
    }
  });
};

const telegramAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  timeout: 120_000,
  autoSelectFamily: true,
  lookup: ipv6First,
});

type TelegramBody = { ok?: boolean; result?: unknown; description?: string };

function telegramRequestOnce(
  url: string,
  body: Buffer,
  contentType: string,
  timeoutMs: number,
): Promise<{ status: number; body: TelegramBody | null }> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        agent: telegramAgent,
        headers: { "Content-Type": contentType, "Content-Length": body.length },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () => {
          clearTimeout(total);
          let parsed: TelegramBody | null = null;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as TelegramBody;
          } catch {
            parsed = null;
          }
          resolve({ status: response.statusCode ?? 0, body: parsed });
        });
      },
    );
    const fail = (code: string, message: string) => request.destroy(Object.assign(new Error(message), { code }));
    const total = setTimeout(() => fail("ETIMEOUT", `timeout: Telegram не ответил за ${timeoutMs / 1000}с`), timeoutMs);
    request.on("socket", (socket) => {
      if (!socket.connecting) {
        return;
      }
      const connect = setTimeout(() => fail("ECONNECT_TIMEOUT", "Telegram: соединение не установилось"), CONNECT_TIMEOUT_MS);
      socket.once("secureConnect", () => clearTimeout(connect));
      socket.once("close", () => clearTimeout(connect));
    });
    request.on("error", (error) => {
      clearTimeout(total);
      reject(Object.assign(error, { reusedSocket: request.reusedSocket }));
    });
    request.end(body);
  });
}

/** Вызов Bot API: JSON или multipart (FormData). Повтор — только если запрос точно не ушёл. */
export async function telegramPost<T = unknown>(
  token: string,
  method: string,
  payload: Record<string, unknown> | FormData,
  timeoutMs = 12_000,
): Promise<{ ok: boolean; status: number; result?: T; error?: string }> {
  let body: Buffer;
  let contentType = "application/json";
  if (payload instanceof FormData) {
    const encoded = new Response(payload);
    body = Buffer.from(await encoded.arrayBuffer());
    contentType = encoded.headers.get("content-type") ?? "multipart/form-data";
  } else {
    body = Buffer.from(JSON.stringify(payload));
  }
  const url = `https://api.telegram.org/bot${token}/${method}`;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await telegramRequestOnce(url, body, contentType, timeoutMs);
      if (response.status < 200 || response.status >= 300 || !response.body?.ok) {
        return {
          ok: false,
          status: response.status,
          error: response.body?.description || `Telegram HTTP ${response.status}`,
        };
      }
      return { ok: true, status: response.status, result: response.body.result as T };
    } catch (error) {
      const { code = "", reusedSocket } = error as NodeJS.ErrnoException & { reusedSocket?: boolean };
      const notSent = RETRY_CODES.has(code) || (reusedSocket === true && code === "ECONNRESET");
      if (!notSent || attempt >= CONNECT_ATTEMPTS) {
        return { ok: false, status: 0, error: formatFetchError(error) };
      }
    }
  }
}

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

export type TelegramChannel = "ops" | "market" | "hunting";

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

  if (channel === "hunting") {
    const token = cleanEnv(process.env.TELEGRAM_HUNTING_BOT_TOKEN);
    const chatId = cleanEnv(process.env.TELEGRAM_HUNTING_CHAT_ID);
    return {
      channel,
      token,
      chatId,
      threadId: parseThreadId(cleanEnv(process.env.TELEGRAM_HUNTING_THREAD_ID)),
      configured: Boolean(token && chatId),
      siteUrl,
      label: "Охота",
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

function notConfiguredError(channel: TelegramChannel): string {
  if (channel === "market") {
    return "TELEGRAM_MARKET_BOT_TOKEN или TELEGRAM_MARKET_CHAT_ID не заданы";
  }
  if (channel === "hunting") {
    return "TELEGRAM_HUNTING_BOT_TOKEN или TELEGRAM_HUNTING_CHAT_ID не заданы";
  }
  return "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы в контейнере";
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

/** Дополнительные группы для рассылок охотничьего бота: id через запятую или пробел. */
export function huntingExtraChatIds(): string[] {
  return cleanEnv(process.env.TELEGRAM_HUNTING_EXTRA_CHAT_IDS)
    .split(/[\s,;]+/)
    .filter((id) => /^-?\d+$/.test(id) || /^@\w+$/.test(id));
}

/**
 * Текст в Telegram. У канала «hunting» рассылка уходит в основной чат и во все TELEGRAM_HUNTING_EXTRA_CHAT_IDS.
 */
export async function sendTelegramMessage(
  text: string,
  channel: TelegramChannel = "ops",
  options: { html?: boolean } = {},
): Promise<TelegramSendResult> {
  const config = getTelegramChannelConfig(channel);
  if (!config.configured) {
    return { ok: false, configured: false, error: notConfiguredError(channel) };
  }
  const main = await postTelegramText(config, config.chatId, config.threadId, text, options);
  if (channel === "hunting") {
    for (const chatId of huntingExtraChatIds().filter((id) => id !== config.chatId)) {
      await postTelegramText(config, chatId, null, text, options);
    }
  }
  return main;
}

async function postTelegramText(
  config: TelegramChannelConfig,
  chatId: string,
  threadId: number | null,
  text: string,
  options: { html?: boolean },
): Promise<TelegramSendResult> {
  const { token, label, channel } = config;
  const result = await telegramPost(token, "sendMessage", {
    chat_id: toChatId(chatId),
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
    ...(options.html ? { parse_mode: "HTML" } : {}),
    ...(threadId != null ? { message_thread_id: threadId } : {}),
  });
  if (!result.ok) {
    console.error("telegram send failed", { channel, label, error: result.error, chatId, status: result.status });
    return { ok: false, configured: true, status: result.status || undefined, error: result.error };
  }
  return { ok: true, configured: true, status: result.status };
}

/** Любой метод Bot API от имени бота канала (setWebhook, setMyCommands, getMe…). */
export async function callTelegramApi<T = unknown>(
  channel: TelegramChannel,
  method: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; result?: T; error?: string }> {
  const { token } = getTelegramChannelConfig(channel);
  if (!token) {
    return { ok: false, error: notConfiguredError(channel) };
  }
  const { ok, result, error } = await telegramPost<T>(token, method, payload);
  return { ok, result, error };
}

/** Ответ в конкретный чат (личка или группа, откуда пришла команда). */
export async function sendTelegramTo(
  channel: TelegramChannel,
  chatId: string | number,
  text: string,
  threadId?: number | null,
  options: { html?: boolean } = {},
): Promise<TelegramSendResult> {
  const result = await callTelegramApi(channel, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
    ...(options.html ? { parse_mode: "HTML" } : {}),
    ...(threadId != null ? { message_thread_id: threadId } : {}),
  });
  return { ok: result.ok, configured: true, error: result.error };
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
    return { ok: false, configured: false, error: notConfiguredError(channel) };
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
  const result = await telegramPost(
    token,
    "sendPhoto",
    {
      chat_id: toChatId(chatId),
      photo: photoUrl,
      caption,
      ...(threadId != null ? { message_thread_id: threadId } : {}),
    },
    20_000,
  );
  return { ok: result.ok, configured: true, status: result.status || undefined, error: result.error };
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

    const result = await telegramPost(token, "sendPhoto", form, 20_000);
    return { ok: result.ok, configured: true, status: result.status || undefined, error: result.error };
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

/** Описание для подписи к фото: подпись Telegram ограничена 1024 символами. */
function captionDescription(description?: string | null): string | null {
  const desc = description?.trim();
  return desc && desc.length > 280 ? `${desc.slice(0, 277).trimEnd()}…` : desc || null;
}

export function notifyTelegramNewProduct(
  product: {
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    listPrice?: number | null;
    stock?: number;
    catalogLine?: string;
  } & ProductSpecsInput,
) {
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
        captionDescription(product.description),
        `Направление: ${line}`,
        `Прайс: ${price}`,
        `Остаток: ${stock}`,
        ...telegramSpecLines(product),
      ]
        .filter((line) => line !== null)
        .join("\n"),
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

export function notifyTelegramFeedback(input: {
  message: string;
  name?: string | null;
  contact?: string | null;
  productName?: string | null;
  ipAddress?: string | null;
}) {
  const siteUrl = getPublicSiteUrl();
  const text = input.message.trim();
  const preview =
    text.length > 500 ? `${text.slice(0, 497).trimEnd()}…` : text;

  fireAndForget(
    sendTelegramMessage(
      [
        "✉️ Обратная связь с витрины",
        input.productName ? `Товар: ${input.productName}` : null,
        input.name?.trim() ? `Имя: ${input.name.trim()}` : null,
        input.contact?.trim() ? `Контакт: ${input.contact.trim()}` : null,
        "",
        preview,
        "",
        input.ipAddress ? `IP: ${input.ipAddress}` : null,
        `Админка: ${siteUrl}/feedback`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    ),
    "feedback",
  );
}

/** Ручная публикация объявления маркет-ботом (kupipro77 / рабочая группа). */
export function buildMarketListingCaption(
  product: {
    name: string;
    description?: string | null;
    listPrice: number;
    stock?: number | null;
  } & ProductSpecsInput,
): string {
  const siteUrl = getPublicSiteUrl();
  const price = `${Math.round(product.listPrice).toLocaleString("ru-RU")} ₽`;
  return [
    product.name.trim(),
    `Цена: ${price}`,
    captionDescription(product.description),
    ...telegramSpecLines(product),
    product.stock != null ? `В наличии: ${product.stock} шт` : null,
    "",
    "Информация о способах приобретения доступна на витрине:",
    siteUrl,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function publishProductToMarketChat(
  product: {
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    listPrice: number;
    stock?: number | null;
  } & ProductSpecsInput,
): Promise<TelegramSendResult> {
  return sendTelegramPhoto({
    channel: "market",
    imageUrl: product.imageUrl,
    caption: buildMarketListingCaption(product),
  });
}
