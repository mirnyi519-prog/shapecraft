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

function buildBuckets(period: SalesChartPeriod, now: Date): SalesChartPoint[] {
  if (period === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(hour)}`,
      label: `${pad2(hour)}`,
      revenue: 0,
      quantity: 0,
    }));
  }

  if (period === "week") {
    const start = startOfWeekMonday(now);
    const weekdayLabels = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return {
        key: `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`,
        label: weekdayLabels[index],
        revenue: 0,
        quantity: 0,
      };
    });
  }

  if (period === "month") {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return {
        key: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(day)}`,
        label: String(day),
        revenue: 0,
        quantity: 0,
      };
    });
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(now.getFullYear(), index, 1);
    return {
      key: `${now.getFullYear()}-${pad2(index + 1)}`,
      label: new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(month),
      revenue: 0,
      quantity: 0,
    };
  });
}

function bucketKey(period: SalesChartPeriod, soldAt: Date): string {
  if (period === "day") {
    return `${soldAt.getFullYear()}-${pad2(soldAt.getMonth() + 1)}-${pad2(soldAt.getDate())}T${pad2(soldAt.getHours())}`;
  }
  if (period === "year") {
    return `${soldAt.getFullYear()}-${pad2(soldAt.getMonth() + 1)}`;
  }
  return `${soldAt.getFullYear()}-${pad2(soldAt.getMonth() + 1)}-${pad2(soldAt.getDate())}`;
}

function rangeStart(period: SalesChartPeriod, now: Date): Date {
  if (period === "day") {
    return startOfLocalDay(now);
  }
  if (period === "week") {
    return startOfWeekMonday(now);
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function rangeEnd(period: SalesChartPeriod, now: Date): Date {
  if (period === "day") {
    const end = startOfLocalDay(now);
    end.setDate(end.getDate() + 1);
    return end;
  }
  if (period === "week") {
    const end = startOfWeekMonday(now);
    end.setDate(end.getDate() + 7);
    return end;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return new Date(now.getFullYear() + 1, 0, 1);
}

export function salesChartPeriodLabel(period: SalesChartPeriod, now = new Date()): string {
  if (period === "day") {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
  }
  if (period === "week") {
    const start = startOfWeekMonday(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
    });
    return `${fmt.format(start)} — ${fmt.format(end)}`;
  }
  if (period === "month") {
    return new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    }).format(now);
  }
  return String(now.getFullYear());
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
  const from = rangeStart(period, now);
  const to = rangeEnd(period, now);
  const points = buildBuckets(period, now);

  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from, lt: to } },
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
