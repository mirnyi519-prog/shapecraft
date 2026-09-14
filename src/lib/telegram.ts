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

function relayCandidates(primary: string): string[] {
  const list = [
    primary,
    "http://host.docker.internal:3098",
    "http://172.17.0.1:3098",
    "http://172.18.0.1:3098",
    "http://172.19.0.1:3098",
  ]
    .map((item) => cleanEnv(item))
    .filter(Boolean);

  return [...new Set(list)];
}

export function getTelegramConfig(): {
  token: string;
  chatId: string;
  configured: boolean;
  relayUrl: string;
  relaySecret: string;
} {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);
  const relayUrl = cleanEnv(process.env.TELEGRAM_RELAY_URL);
  const relaySecret = cleanEnv(process.env.TELEGRAM_RELAY_SECRET);
  return {
    token,
    chatId,
    configured: Boolean((token && chatId) || relayUrl),
    relayUrl,
    relaySecret,
  };
}

async function sendViaRelay(
  relayUrl: string,
  text: string,
  relaySecret: string,
): Promise<TelegramSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (relaySecret) {
      headers.Authorization = `Bearer ${relaySecret}`;
    }
    const response = await fetch(`${relayUrl.replace(/\/$/, "")}/send`, {
      method: "POST",
      headers,
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
  const { token, chatId, configured, relayUrl, relaySecret } =
    getTelegramConfig();

  if (!configured) {
    return {
      ok: false,
      configured: false,
      error:
        "Задайте TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (и relay на сервере)",
    };
  }

  const errors: string[] = [];

  for (const candidate of relayCandidates(relayUrl)) {
    const viaRelay = await sendViaRelay(candidate, text, relaySecret);
    if (viaRelay.ok) {
      return viaRelay;
    }
    errors.push(`${candidate} -> ${viaRelay.error}`);
  }

  if (token && chatId) {
    const direct = await sendDirect(token, chatId, text);
    if (direct.ok) {
      return direct;
    }
    errors.push(`direct -> ${direct.error}`);
  }

  return {
    ok: false,
    configured: true,
    error: errors.join("; "),
  };
}
