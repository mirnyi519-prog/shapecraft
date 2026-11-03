import { runHuntingSchedule } from "@/lib/hunting-bot";
import { startHuntingPolling } from "@/lib/hunting-polling";
import { runRetentionIfDue } from "@/lib/retention";

const TICK_MS = 30 * 60_000;
const FIRST_TICK_MS = 90_000;

const state = globalThis as typeof globalThis & { __huntingScheduler?: NodeJS.Timeout };

/** Сообщения боту — long polling; каждые полчаса: сверка с МООиР, напоминания и прогноз, ночью — уборка старых данных. */
export function startHuntingScheduler() {
  if (state.__huntingScheduler) {
    return;
  }
  startHuntingPolling();
  let busy = false;
  const tick = () => {
    if (busy) {
      return;
    }
    busy = true;
    runHuntingSchedule()
      .catch((error) => console.error("hunting schedule", error))
      .then(() => runRetentionIfDue())
      .catch((error) => console.error("retention", error))
      .finally(() => {
        busy = false;
      });
  };
  setTimeout(tick, FIRST_TICK_MS).unref();
  state.__huntingScheduler = setInterval(tick, TICK_MS);
  state.__huntingScheduler.unref();
}
