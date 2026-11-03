import { handleHuntingUpdate } from "@/lib/hunting-bot";
import { getTelegramChannelConfig, telegramPost } from "@/lib/telegram";

/**
 * Long polling вместо webhook: входящие соединения Telegram до сервера часто не доходят
 * («Connection timed out» в getWebhookInfo), и сообщение приходило с опозданием на повторах.
 * Исходящий getUpdates по IPv6 держится стабильно и отдаёт сообщение сразу.
 */
const POLL_TIMEOUT_S = 50;
const RETRY_PAUSE_MS = 3_000;
const ALLOWED_UPDATES = ["message", "callback_query"];

const state = globalThis as typeof globalThis & { __huntingPolling?: boolean };

type Update = { update_id: number } & Parameters<typeof handleHuntingUpdate>[0];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startHuntingPolling() {
  const { token } = getTelegramChannelConfig("hunting");
  if (!token || state.__huntingPolling) {
    return;
  }
  state.__huntingPolling = true;
  void pollLoop(token);
}

async function pollLoop(token: string) {
  let offset: number | undefined;
  let webhookRemoved = false;
  for (;;) {
    if (!webhookRemoved) {
      const removed = await telegramPost(token, "deleteWebhook", { drop_pending_updates: false });
      if (!removed.ok) {
        console.error("hunting polling: deleteWebhook", removed.error);
        await pause(RETRY_PAUSE_MS);
        continue;
      }
      webhookRemoved = true;
    }
    const batch = await telegramPost<Update[]>(
      token,
      "getUpdates",
      { offset, timeout: POLL_TIMEOUT_S, allowed_updates: ALLOWED_UPDATES },
      (POLL_TIMEOUT_S + 15) * 1000,
    );
    if (!batch.ok) {
      // 409 — снова включился webhook (например, кнопкой «Подключить» на старой версии).
      if (batch.status === 409) {
        webhookRemoved = false;
      }
      console.error("hunting polling: getUpdates", batch.error);
      await pause(RETRY_PAUSE_MS);
      continue;
    }
    for (const update of batch.result ?? []) {
      offset = update.update_id + 1;
      // Не ждём: разговор с GigaChat не должен задерживать ответы другим охотникам.
      void handleHuntingUpdate(update).catch((error) => console.error("hunting bot update", error));
    }
  }
}
