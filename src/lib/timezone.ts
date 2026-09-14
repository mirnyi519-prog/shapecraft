/** Единая таймзона ShapeCraft: Москва (UTC+3, без перевода часов с 2014). */
export const MOSCOW_TZ = "Europe/Moscow";
export const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export type MoscowYmd = {
  year: number;
  month: number;
  day: number;
};

export function formatMoscow(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TZ,
    ...options,
  }).format(new Date(value));
}

/** Календарная дата в Москве (месяц 1–12). */
export function moscowYmd(date: Date | string | number = new Date()): MoscowYmd {
  const raw = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
  const [year, month, day] = raw.split("-").map(Number);
  return { year, month, day };
}

/** Instant полуночи по Москве для календарного дня `date`. */
export function startOfMoscowDay(date: Date | string | number = new Date()): Date {
  const { year, month, day } = moscowYmd(date);
  return new Date(Date.UTC(year, month - 1, day) - MOSCOW_OFFSET_MS);
}

export function addMoscowDays(date: Date, days: number): Date {
  return new Date(startOfMoscowDay(date).getTime() + days * 24 * 60 * 60 * 1000);
}

/** День недели в Москве: 0 = вс … 6 = сб (как Date#getDay). */
export function moscowWeekday(date: Date): number {
  const shifted = new Date(date.getTime() + MOSCOW_OFFSET_MS);
  return shifted.getUTCDay();
}

/** Понедельник 00:00 МСК для недели, в которой лежит `date`. */
export function startOfMoscowWeekMonday(date: Date = new Date()): Date {
  const start = startOfMoscowDay(date);
  const weekday = moscowWeekday(start);
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addMoscowDays(start, -offset);
}
