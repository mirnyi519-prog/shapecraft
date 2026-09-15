import { prisma } from "@/lib/db";
import {
  MOSCOW_TZ,
  addMoscowDays,
  moscowYmd,
  startOfMoscowDay,
  startOfMoscowWeekMonday,
} from "@/lib/timezone";

export type VisitsChartPeriod = "day" | "week" | "month";

export type VisitsChartPoint = {
  key: string;
  label: string;
  visits: number;
  uniqueVisitors: number;
};

export type VisitsChartSeries = {
  period: VisitsChartPeriod;
  label: string;
  points: VisitsChartPoint[];
  totalVisits: number;
  uniqueVisitors: number;
  peakVisits: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date): string {
  const { year, month, day } = moscowYmd(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function weekKey(monday: Date): string {
  return `W${dayKey(monday)}`;
}

function monthKey(date: Date): string {
  const { year, month } = moscowYmd(date);
  return `${year}-${pad2(month)}`;
}

function visitorKey(visit: {
  visitorId: string | null;
  ipAddress: string;
}): string {
  return visit.visitorId?.trim() || `ip:${visit.ipAddress}`;
}

function buildDayBuckets(now: Date, days = 30): VisitsChartPoint[] {
  const end = startOfMoscowDay(now);
  const start = addMoscowDays(end, -(days - 1));
  const points: VisitsChartPoint[] = [];
  let cursor = start;

  while (cursor <= end) {
    const { day, month } = moscowYmd(cursor);
    points.push({
      key: dayKey(cursor),
      label: `${day}.${pad2(month)}`,
      visits: 0,
      uniqueVisitors: 0,
    });
    cursor = addMoscowDays(cursor, 1);
  }

  return points;
}

function buildWeekBuckets(now: Date, weeks = 12): VisitsChartPoint[] {
  const end = startOfMoscowWeekMonday(now);
  const points: VisitsChartPoint[] = [];
  let cursor = addMoscowDays(end, -(weeks - 1) * 7);

  while (cursor <= end) {
    points.push({
      key: weekKey(cursor),
      label: "",
      visits: 0,
      uniqueVisitors: 0,
    });
    cursor = addMoscowDays(cursor, 7);
  }

  return points.map((point, index) => ({
    ...point,
    label: `н${index + 1}`,
  }));
}

function buildMonthBuckets(now: Date, months = 12): VisitsChartPoint[] {
  const { year, month } = moscowYmd(now);
  const points: VisitsChartPoint[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    let m = month - offset;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const sample = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
    points.push({
      key: `${y}-${pad2(m)}`,
      label: new Intl.DateTimeFormat("ru-RU", {
        timeZone: MOSCOW_TZ,
        month: "short",
      }).format(sample),
      visits: 0,
      uniqueVisitors: 0,
    });
  }

  return points;
}

function bucketKey(period: VisitsChartPeriod, visitedAt: Date): string {
  if (period === "day") {
    return dayKey(visitedAt);
  }
  if (period === "week") {
    return weekKey(startOfMoscowWeekMonday(visitedAt));
  }
  return monthKey(visitedAt);
}

function rangeForPeriod(
  period: VisitsChartPeriod,
  now: Date,
): { from: Date; to: Date } {
  const to = addMoscowDays(startOfMoscowDay(now), 1);

  if (period === "day") {
    return { from: addMoscowDays(startOfMoscowDay(now), -29), to };
  }
  if (period === "week") {
    const monday = startOfMoscowWeekMonday(now);
    return { from: addMoscowDays(monday, -11 * 7), to };
  }

  const { year, month } = moscowYmd(now);
  let m = month - 11;
  let y = year;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return {
    from: new Date(Date.UTC(y, m - 1, 1) - 3 * 60 * 60 * 1000),
    to,
  };
}

export function visitsChartPeriodLabel(
  period: VisitsChartPeriod,
  now = new Date(),
): string {
  if (period === "day") {
    return "По дням · последние 30 дней";
  }
  if (period === "week") {
    return "По неделям · последние 12 недель";
  }
  return `По месяцам · последние 12 мес. · ${moscowYmd(now).year}`;
}

export function parseVisitsChartPeriod(
  value: string | null | undefined,
): VisitsChartPeriod {
  if (value === "day" || value === "week" || value === "month") {
    return value;
  }
  return "day";
}

export async function getVisitsChartSeries(
  period: VisitsChartPeriod = "day",
): Promise<VisitsChartSeries> {
  const now = new Date();
  const points =
    period === "day"
      ? buildDayBuckets(now)
      : period === "week"
        ? buildWeekBuckets(now)
        : buildMonthBuckets(now);

  const { from, to } = rangeForPeriod(period, now);
  const visits = await prisma.siteVisit.findMany({
    where: {
      visitedAt: { gte: from, lt: to },
    },
    select: {
      visitedAt: true,
      visitorId: true,
      ipAddress: true,
    },
  });

  const index = new Map(points.map((point, i) => [point.key, i]));
  const uniques = new Map<string, Set<string>>();
  for (const point of points) {
    uniques.set(point.key, new Set());
  }

  const allVisitors = new Set<string>();
  let totalVisits = 0;

  for (const visit of visits) {
    const key = bucketKey(period, visit.visitedAt);
    const pointIndex = index.get(key);
    if (pointIndex === undefined) {
      continue;
    }
    points[pointIndex].visits += 1;
    totalVisits += 1;
    const id = visitorKey(visit);
    uniques.get(key)?.add(id);
    allVisitors.add(id);
  }

  let peakVisits = 0;
  for (const point of points) {
    point.uniqueVisitors = uniques.get(point.key)?.size ?? 0;
    if (point.visits > peakVisits) {
      peakVisits = point.visits;
    }
  }

  return {
    period,
    label: visitsChartPeriodLabel(period, now),
    points,
    totalVisits,
    uniqueVisitors: allVisitors.size,
    peakVisits,
  };
}

export type VisitsHourlyPoint = {
  hour: number;
  label: string;
  visits: number;
  uniqueVisitors: number;
};

export type VisitsHourlySeries = {
  period: VisitsChartPeriod;
  label: string;
  points: VisitsHourlyPoint[];
  totalVisits: number;
  uniqueVisitors: number;
  peakHour: number | null;
  peakVisits: number;
};

function moscowHour(date: Date): number {
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.getUTCHours();
}

function hourlyWindowLabel(period: VisitsChartPeriod): string {
  if (period === "day") {
    return "Часы входа · МСК · последние 30 дней";
  }
  if (period === "week") {
    return "Часы входа · МСК · последние 12 недель";
  }
  return "Часы входа · МСК · последние 12 мес.";
}

export async function getVisitsHourlySeries(
  period: VisitsChartPeriod = "day",
): Promise<VisitsHourlySeries> {
  const now = new Date();
  const { from, to } = rangeForPeriod(period, now);
  const visits = await prisma.siteVisit.findMany({
    where: {
      visitedAt: { gte: from, lt: to },
    },
    select: {
      visitedAt: true,
      visitorId: true,
      ipAddress: true,
    },
  });

  const points: VisitsHourlyPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${pad2(hour)}:00`,
    visits: 0,
    uniqueVisitors: 0,
  }));
  const uniques = Array.from({ length: 24 }, () => new Set<string>());
  const allVisitors = new Set<string>();

  for (const visit of visits) {
    const hour = moscowHour(visit.visitedAt);
    points[hour].visits += 1;
    const id = visitorKey(visit);
    uniques[hour].add(id);
    allVisitors.add(id);
  }

  let peakHour: number | null = null;
  let peakVisits = 0;
  for (const point of points) {
    point.uniqueVisitors = uniques[point.hour].size;
    if (point.visits > peakVisits) {
      peakVisits = point.visits;
      peakHour = point.hour;
    }
  }

  return {
    period,
    label: hourlyWindowLabel(period),
    points,
    totalVisits: visits.length,
    uniqueVisitors: allVisitors.size,
    peakHour,
    peakVisits,
  };
}
