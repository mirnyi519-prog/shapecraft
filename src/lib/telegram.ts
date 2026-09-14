export type TelegramSendResult = {
  ok: boolean;
  configured: boolean;
  status?: number;
  error?: string;
};

function cleanEnv(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
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
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.slice(0, 4000),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!response.ok || !body?.ok) {
      const error =
        body?.description ||
        `Telegram HTTP ${response.status}`;
      console.error("telegram send failed", error);
      return {
        ok: false,
        configured: true,
        status: response.status,
        error,
      };
    }

    return { ok: true, configured: true, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    console.error("telegram send exception", message);
    return { ok: false, configured: true, error: message };
  }
}
