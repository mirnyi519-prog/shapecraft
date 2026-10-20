export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  // В dev расписание включается явно, чтобы локальный сервер не писал в боевую группу.
  if (process.env.NODE_ENV !== "production" && process.env.HUNTING_SCHEDULER !== "on") {
    return;
  }
  const { startHuntingScheduler } = await import("@/lib/hunting-scheduler");
  startHuntingScheduler();
}
