import dns from "node:dns";

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
  relayUrl: string;
} {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);
  const relayUrl = cleanEnv(process.env.TELEGRAM_RELAY_URL);
  return {
    token,
    chatId,
    configured: Boolean((token && chatId) || relayUrl),
    relayUrl,
  };
}

async function sendViaRelay(
  relayUrl: string,
  text: string,
): Promise<TelegramSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${relayUrl.replace(/\/$/, "")}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      status?: number;
    } | null;
    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        configured: true,
        status: response.status,
        error: body?.error || `relay HTTP ${response.status}`,
      };
    }
    return { ok: true, configured: true, status: body.status ?? response.status };
  } catch (error) {
    return { ok: false, configured: true, error: formatFetchError(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function sendDirect(
  token: string,
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
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
    );
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
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Уведомления в Telegram.
 * Предпочтительно через TELEGRAM_RELAY_URL (host-сеть), иначе напрямую.
 */
export async function sendTelegramMessage(
  text: string,
): Promise<TelegramSendResult> {
  const { token, chatId, configured, relayUrl } = getTelegramConfig();

  if (!configured) {
    return {
      ok: false,
      configured: false,
      error:
        "Задайте TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (и relay на сервере)",
    };
  }

  if (relayUrl) {
    const viaRelay = await sendViaRelay(relayUrl, text);
    if (viaRelay.ok) {
      return viaRelay;
    }
    // fallback на прямой вызов (локальная разработка)
    if (token && chatId) {
      const direct = await sendDirect(token, chatId, text);
      if (direct.ok) {
        return direct;
      }
      return {
        ok: false,
        configured: true,
        error: `relay: ${viaRelay.error}; direct: ${direct.error}`,
      };
    }
    return viaRelay;
  }

  if (!token || !chatId) {
    return {
      ok: false,
      configured: false,
      error: "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы",
    };
  }

  return sendDirect(token, chatId, text);
}
