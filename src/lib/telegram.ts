import dns from "node:dns";

// На части VPS Node сначала лезет в IPv6 → "fetch failed",
// тогда как curl с хоста по IPv4 проходит нормально.
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

export function getTelegramConfig(): {
  token: string;
  chatId: string;
  configured: boolean;
} {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);
  return {
    token,
    chatId,
    configured: Boolean(token && chatId),
  };
}

/**
 * Уведомления в Telegram.
 * Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в env.
 */
export async function sendTelegramMessage(
  text: string,
): Promise<TelegramSendResult> {
  const { token, chatId, configured } = getTelegramConfig();

  if (!configured) {
    return {
      ok: false,
      configured: false,
      error: "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы в контейнере",
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
    console.error("telegram send exception", message);
    return { ok: false, configured: true, error: message };
  }
}
