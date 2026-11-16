import { connectMarketBot, handleMarketUpdate } from "@/lib/market-bot";
import { getTelegramChannelConfig, telegramPost } from "@/lib/telegram";

/**
 * Long polling для ShapeCraft Market — как у охотничьего бота.
 * Команды /price и /прайс обрабатываются в market-bot.
 */
const POLL_TIMEOUT_S = 50;
const RETRY_PAUSE_MS = 3_000;
const ALLOWED_UPDATES = ["message"];

const state = globalThis as typeof globalThis & { __marketPolling?: boolean };

type Update = { update_id: number } & Parameters<typeof handleMarketUpdate>[0];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startMarketPolling() {
  const { token } = getTelegramChannelConfig("market");
  if (!token || state.__marketPolling) {
    return;
  }
  state.__marketPolling = true;
  void pollLoop(token);
}

async function pollLoop(token: string) {
  let offset: number | undefined;
  let ready = false;
  for (;;) {
    if (!ready) {
      const connected = await connectMarketBot();
      if (!connected.ok) {
        console.error("market polling: connect", connected.error);
        await pause(RETRY_PAUSE_MS);
        continue;
      }
      ready = true;
      console.info(
        "market polling: ready",
        connected.username ? `@${connected.username}` : "",
      );
    }

    const batch = await telegramPost<Update[]>(
      token,
      "getUpdates",
      { offset, timeout: POLL_TIMEOUT_S, allowed_updates: ALLOWED_UPDATES },
      (POLL_TIMEOUT_S + 15) * 1000,
    );
    if (!batch.ok) {
      if (batch.status === 409) {
        ready = false;
      }
      console.error("market polling: getUpdates", batch.error);
      await pause(RETRY_PAUSE_MS);
      continue;
    }
    for (const update of batch.result ?? []) {
      offset = update.update_id + 1;
      void handleMarketUpdate(update).catch((error) =>
        console.error("market bot update", error),
      );
    }
  }
}
