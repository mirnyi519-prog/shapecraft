import { MOSCOW_TZ } from "@/lib/timezone";

/** 0 = воскресенье … 6 = суббота (как Date.getDay). */
export type PickupWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PickupDayHours =
  | { closed: true }
  | { closed: false; openMinute: number; closeMinute: number };

export type PickupHoursWeek = Record<PickupWeekday, PickupDayHours>;

export type HoursMode = "auto" | "summer" | "winter";

export type StoreHoursConfig = {
  hoursMode: HoursMode;
  winterStartMonth: number;
  winterStartDay: number;
  winterEndMonth: number;
  winterEndDay: number;
  summerHours: PickupHoursWeek;
  winterHours: PickupHoursWeek;
};

export const WEEKDAY_LABELS: Record<PickupWeekday, string> = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  0: "Воскресенье",
};

/** Порядок строк в UI: пн → вс. */
export const WEEKDAY_ORDER: PickupWeekday[] = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_SUMMER_HOURS: PickupHoursWeek = {
  1: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 },
  2: { closed: true },
  3: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 },
  4: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 },
  5: { closed: false, openMinute: 10 * 60, closeMinute: 21 * 60 },
  6: { closed: false, openMinute: 10 * 60, closeMinute: 21 * 60 },
  0: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 },
};

/** Зима: закрытие на час раньше. */
export const DEFAULT_WINTER_HOURS: PickupHoursWeek = {
  1: { closed: false, openMinute: 10 * 60, closeMinute: 19 * 60 },
  2: { closed: true },
  3: { closed: false, openMinute: 10 * 60, closeMinute: 19 * 60 },
  4: { closed: false, openMinute: 10 * 60, closeMinute: 19 * 60 },
  5: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 },
  6: { closed: false, openMinute: 10 * 60, closeMinute: 20 * 60 },
  0: { closed: false, openMinute: 10 * 60, closeMinute: 19 * 60 },
};

export const DEFAULT_STORE_HOURS_CONFIG: StoreHoursConfig = {
  hoursMode: "auto",
  winterStartMonth: 11,
  winterStartDay: 1,
  winterEndMonth: 3,
  winterEndDay: 31,
  summerHours: DEFAULT_SUMMER_HOURS,
  winterHours: DEFAULT_WINTER_HOURS,
};

export function formatClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseClockToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function formatDayHours(day: PickupDayHours): string {
  if (day.closed) {
    return "выходной";
  }
  return `${formatClock(day.openMinute)}–${formatClock(day.closeMinute)}`;
}

export function hoursRowsFromWeek(
  week: PickupHoursWeek,
): { label: string; value: string }[] {
  return WEEKDAY_ORDER.map((day) => ({
    label: WEEKDAY_LABELS[day],
    value: formatDayHours(week[day]),
  }));
}

function clampDay(month: number, day: number): number {
  const max = new Date(Date.UTC(2024, month, 0)).getUTCDate();
  return Math.min(Math.max(1, day), max);
}

export function monthDayKey(month: number, day: number): number {
  return month * 100 + clampDay(month, day);
}

/** Зимний период может пересекать Новый год (ноя→мар). */
export function isWinterDate(
  month: number,
  day: number,
  config: Pick<
    StoreHoursConfig,
    | "winterStartMonth"
    | "winterStartDay"
    | "winterEndMonth"
    | "winterEndDay"
  >,
): boolean {
  const current = monthDayKey(month, day);
  const start = monthDayKey(config.winterStartMonth, config.winterStartDay);
  const end = monthDayKey(config.winterEndMonth, config.winterEndDay);

  if (start <= end) {
    return current >= start && current <= end;
  }
  // через год: ноя–дек или янв–мар
  return current >= start || current <= end;
}

export function resolveActiveSeason(
  config: StoreHoursConfig,
  now: Date = new Date(),
): "summer" | "winter" {
  if (config.hoursMode === "summer") {
    return "summer";
  }
  if (config.hoursMode === "winter") {
    return "winter";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TZ,
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");
  return isWinterDate(month, day, config) ? "winter" : "summer";
}

export function activeHoursWeek(
  config: StoreHoursConfig,
  now: Date = new Date(),
): PickupHoursWeek {
  return resolveActiveSeason(config, now) === "winter"
    ? config.winterHours
    : config.summerHours;
}

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

export type PickupOpenStatus = {
  isOpenNow: boolean;
  canPickupToday: boolean;
  headline: string;
  detail: string;
  season: "summer" | "winter";
  seasonLabel: string;
};

export function getPickupOpenStatus(
  config: StoreHoursConfig = DEFAULT_STORE_HOURS_CONFIG,
  now: Date = new Date(),
): PickupOpenStatus {
  const season = resolveActiveSeason(config, now);
  const week = season === "winter" ? config.winterHours : config.summerHours;
  const { weekday, minuteOfDay } = moscowParts(now);
  const today = week[weekday];
  const seasonLabel = season === "winter" ? "зимний график" : "летний график";

  if (today.closed) {
    return {
      isOpenNow: false,
      canPickupToday: false,
      headline: "Сегодня выходной",
      detail: `Сейчас ${seasonLabel}. Напишите — подскажем, когда лучше заехать`,
      season,
      seasonLabel,
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
      detail: `Сегодня до ${closeLabel} · ${seasonLabel}`,
      season,
      seasonLabel,
    };
  }

  if (minuteOfDay < today.openMinute) {
    return {
      isOpenNow: false,
      canPickupToday: true,
      headline: "Сегодня можно забрать",
      detail: `Откроемся в ${openLabel}, до ${closeLabel} · ${seasonLabel}`,
      season,
      seasonLabel,
    };
  }

  return {
    isOpenNow: false,
    canPickupToday: false,
    headline: "Сегодня уже закрыто",
    detail: `Были до ${closeLabel} · ${seasonLabel}`,
    season,
    seasonLabel,
  };
}

function parseDayHours(raw: unknown): PickupDayHours | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (row.closed === true) {
    return { closed: true };
  }
  const openMinute = Number(row.openMinute);
  const closeMinute = Number(row.closeMinute);
  if (
    !Number.isFinite(openMinute) ||
    !Number.isFinite(closeMinute) ||
    openMinute < 0 ||
    closeMinute > 24 * 60 ||
    openMinute >= closeMinute
  ) {
    return null;
  }
  return {
    closed: false,
    openMinute: Math.round(openMinute),
    closeMinute: Math.round(closeMinute),
  };
}

export function parseHoursWeekJson(
  json: string,
  fallback: PickupHoursWeek,
): PickupHoursWeek {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const next = { ...fallback };
    for (const key of WEEKDAY_ORDER) {
      const day = parseDayHours(parsed[String(key)]);
      if (day) {
        next[key] = day;
      }
    }
    return next;
  } catch {
    return fallback;
  }
}

export function serializeHoursWeek(week: PickupHoursWeek): string {
  return JSON.stringify(week);
}

export function isHoursMode(value: unknown): value is HoursMode {
  return value === "auto" || value === "summer" || value === "winter";
}
