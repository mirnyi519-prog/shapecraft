import { MOSCOW_TZ } from "@/lib/timezone";

/** 0 = воскресенье … 6 = суббота (как Date.getDay). */
export type PickupWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PickupDayHours =
  | { closed: true }
  | { closed: false; openMinute: number; closeMinute: number };

/** Часы пекарни «У Светланы» (выдача ShapeCraft), по Москве. */
export const PICKUP_HOURS_BY_WEEKDAY: Record<PickupWeekday, PickupDayHours> = {
  1: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 }, // пн
  2: { closed: true }, // вт
  3: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 }, // ср
  4: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 }, // чт
  5: { closed: false, openMinute: 10 * 60, closeMinute: 21 * 60 }, // пт
  6: { closed: false, openMinute: 10 * 60, closeMinute: 21 * 60 }, // сб
  0: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 }, // вс
};

export const PICKUP_HOURS_ROWS: { label: string; value: string }[] = [
  { label: "Понедельник", value: "10:00–20:00" },
  { label: "Вторник", value: "выходной" },
  { label: "Среда", value: "10:00–20:00" },
  { label: "Четверг", value: "10:00–20:00" },
  { label: "Пятница", value: "10:00–21:00" },
  { label: "Суббота", value: "10:00–21:00" },
  { label: "Воскресенье", value: "10:00–20:00" },
];

function formatClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type PickupOpenStatus = {
  isOpenNow: boolean;
  /** Можно забрать в этот календарный день (не вт). */
  canPickupToday: boolean;
  headline: string;
  detail: string;
};

function moscowParts(now: Date = new Date()): {
  weekday: PickupWeekday;
  minuteOfDay: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayRaw = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  const map: Record<string, PickupWeekday> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: map[weekdayRaw] ?? 1,
    minuteOfDay: hour * 60 + minute,
  };
}

export function getPickupOpenStatus(now: Date = new Date()): PickupOpenStatus {
  const { weekday, minuteOfDay } = moscowParts(now);
  const today = PICKUP_HOURS_BY_WEEKDAY[weekday];

  if (today.closed) {
    return {
      isOpenNow: false,
      canPickupToday: false,
      headline: "Сегодня выходной",
      detail: "Завтра обычно открыты с 10:00 — напишите, подскажем наличие",
    };
  }

  const openLabel = formatClock(today.openMinute);
  const closeLabel = formatClock(today.closeMinute);
  const isOpenNow =
    minuteOfDay >= today.openMinute && minuteOfDay < today.closeMinute;

  if (isOpenNow) {
    return {
      isOpenNow: true,
      canPickupToday: true,
      headline: "Сейчас открыто — можно забрать сегодня",
      detail: `Сегодня до ${closeLabel}`,
    };
  }

  if (minuteOfDay < today.openMinute) {
    return {
      isOpenNow: false,
      canPickupToday: true,
      headline: "Сегодня можно забрать",
      detail: `Откроемся в ${openLabel}, до ${closeLabel}`,
    };
  }

  return {
    isOpenNow: false,
    canPickupToday: false,
    headline: "Сегодня уже закрыто",
    detail: `Были до ${closeLabel}. Завтра или напишите — подскажем`,
  };
}
