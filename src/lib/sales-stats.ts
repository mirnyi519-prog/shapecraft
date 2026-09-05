import { prisma } from "@/lib/db";

export type SalesTotals = {
  count: number;
  saleCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  ownerShare: number;
  partnerShare: number;
};

export type SalesChartPeriod = "day" | "week" | "month" | "year";

export type SalesChartPoint = {
  key: string;
  label: string;
  revenue: number;
  quantity: number;
};

export type SalesChartSeries = {
  period: SalesChartPeriod;
  label: string;
  points: SalesChartPoint[];
  totalRevenue: number;
  totalQuantity: number;
  totalCost: number;
  ownerShare: number;
  partnerShare: number;
  saleCount: number;
};

export type TopSoldProduct = {
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  revenue: number;
};

export async function getAllTimeSalesTotals(): Promise<SalesTotals> {
  const agg = await prisma.sale.aggregate({
    _sum: {
      quantity: true,
      amount: true,
      costTotal: true,
      profit: true,
      ownerShare: true,
      partnerShare: true,
    },
    _count: { id: true },
  });

  return {
    count: agg._sum.quantity ?? 0,
    saleCount: agg._count.id,
    totalRevenue: agg._sum.amount ?? 0,
    totalCost: agg._sum.costTotal ?? 0,
    totalProfit: agg._sum.profit ?? 0,
    ownerShare: agg._sum.ownerShare ?? 0,
    partnerShare: agg._sum.partnerShare ?? 0,
  };
}

export async function getTopSoldProducts(limit = 10): Promise<TopSoldProduct[]> {
  const grouped = await prisma.sale.groupBy({
    by: ["productId"],
    _sum: { quantity: true, amount: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((item) => item.productId) } },
    select: { id: true, name: true, imageUrl: true },
  });
  const productMap = new Map(products.map((item) => [item.id, item]));

  return grouped.map((item) => {
    const product = productMap.get(item.productId);
    return {
      productId: item.productId,
      name: product?.name ?? "—",
      imageUrl: product?.imageUrl ?? null,
      quantity: item._sum.quantity ?? 0,
      revenue: item._sum.amount ?? 0,
    };
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeekMonday(date: Date): Date {
  const start = startOfLocalDay(date);
  const weekday = start.getDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - offset);
  return start;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function weekKey(monday: Date): string {
  return `W${dayKey(monday)}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function yearKey(date: Date): string {
  return String(date.getFullYear());
}

function buildDayBuckets(now: Date): SalesChartPoint[] {
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const end = startOfLocalDay(now);
  const points: SalesChartPoint[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    points.push({
      key: dayKey(cursor),
      label: `${cursor.getDate()}.${pad2(cursor.getMonth() + 1)}`,
      revenue: 0,
      quantity: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

function buildWeekBuckets(now: Date): SalesChartPoint[] {
  const year = now.getFullYear();
  const end = startOfWeekMonday(now);
  let cursor = startOfWeekMonday(new Date(year, 0, 1));
  const points: SalesChartPoint[] = [];
  let weekNum = 1;

  while (cursor <= end) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(cursor.getDate() + 6);
    if (weekEnd.getFullYear() >= year && cursor.getFullYear() <= year) {
      points.push({
        key: weekKey(cursor),
        label: `н${weekNum}`,
        revenue: 0,
        quantity: 0,
      });
      weekNum += 1;
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }

  return points;
}

function buildMonthBuckets(now: Date): SalesChartPoint[] {
  const year = now.getFullYear();
  return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(year, index, 1);
    return {
      key: monthKey(month),
      label: new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(month),
      revenue: 0,
      quantity: 0,
    };
  });
}

function buildYearBuckets(fromYear: number, toYear: number): SalesChartPoint[] {
  const start = Math.min(fromYear, toYear);
  const end = Math.max(fromYear, toYear);
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const year = start + index;
    return {
      key: String(year),
      label: String(year),
      revenue: 0,
      quantity: 0,
    };
  });
}

function bucketKey(period: SalesChartPeriod, soldAt: Date): string {
  if (period === "day") {
    return dayKey(soldAt);
  }
  if (period === "week") {
    return weekKey(startOfWeekMonday(soldAt));
  }
  if (period === "month") {
    return monthKey(soldAt);
  }
  return yearKey(soldAt);
}

function rangeForPeriod(
  period: SalesChartPeriod,
  now: Date,
  earliestYear: number,
): { from: Date | null; to: Date | null } {
  if (period === "year") {
    return {
      from: new Date(earliestYear, 0, 1),
      to: new Date(now.getFullYear() + 1, 0, 1),
    };
  }

  return {
    from: new Date(now.getFullYear(), 0, 1),
    to: new Date(now.getFullYear() + 1, 0, 1),
  };
}

export function salesChartPeriodLabel(period: SalesChartPeriod, now = new Date()): string {
  const year = now.getFullYear();
  if (period === "day") {
    return `По дням · ${year}`;
  }
  if (period === "week") {
    return `По неделям · ${year}`;
  }
  if (period === "month") {
    return `По месяцам · ${year}`;
  }
  return "По годам";
}

export function parseSalesChartPeriod(
  value: string | null | undefined,
): SalesChartPeriod {
  if (value === "day" || value === "week" || value === "month" || value === "year") {
    return value;
  }
  return "month";
}

export async function getSalesChartSeries(
  period: SalesChartPeriod = "month",
): Promise<SalesChartSeries> {
  const now = new Date();

  const firstSale = await prisma.sale.findFirst({
    orderBy: { soldAt: "asc" },
    select: { soldAt: true },
  });
  const earliestYear = firstSale?.soldAt.getFullYear() ?? now.getFullYear();

  const points =
    period === "day"
      ? buildDayBuckets(now)
      : period === "week"
        ? buildWeekBuckets(now)
        : period === "month"
          ? buildMonthBuckets(now)
          : buildYearBuckets(earliestYear, now.getFullYear());

  const { from, to } = rangeForPeriod(period, now, earliestYear);

  const sales = await prisma.sale.findMany({
    where: {
      soldAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lt: to } : {}),
      },
    },
    select: {
      soldAt: true,
      amount: true,
      quantity: true,
      costTotal: true,
      ownerShare: true,
      partnerShare: true,
    },
  });

  const index = new Map(points.map((point, i) => [point.key, i]));
  let totalRevenue = 0;
  let totalQuantity = 0;
  let totalCost = 0;
  let ownerShare = 0;
  let partnerShare = 0;
  let saleCount = 0;

  for (const sale of sales) {
    const key = bucketKey(period, sale.soldAt);
    const pointIndex = index.get(key);
    if (pointIndex === undefined) {
      continue;
    }
    points[pointIndex].revenue += sale.amount;
    points[pointIndex].quantity += sale.quantity;
    totalRevenue += sale.amount;
    totalQuantity += sale.quantity;
    totalCost += sale.costTotal;
    ownerShare += sale.ownerShare;
    partnerShare += sale.partnerShare;
    saleCount += 1;
  }

  return {
    period,
    label: salesChartPeriodLabel(period, now),
    points,
    totalRevenue,
    totalQuantity,
    totalCost,
    ownerShare,
    partnerShare,
    saleCount,
  };
}
