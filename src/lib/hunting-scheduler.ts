import { runHuntingSchedule } from "@/lib/hunting-bot";
import { runRetentionIfDue } from "@/lib/retention";

const TICK_MS = 30 * 60_000;
const FIRST_TICK_MS = 90_000;

const state = globalThis as typeof globalThis & { __huntingScheduler?: NodeJS.Timeout };

/** Каждые полчаса: сверка с МООиР, напоминания и прогноз на выходные в охотничью группу, ночью — уборка старых данных. */
export function startHuntingScheduler() {
  if (state.__huntingScheduler) {
    return;
  }
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
