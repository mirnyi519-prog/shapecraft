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
  points: SalesChartPoint[];
  totalRevenue: number;
  totalQuantity: number;
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

function buildBuckets(period: SalesChartPeriod, now: Date): SalesChartPoint[] {
  if (period === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(hour)}`,
      label: `${pad2(hour)}:00`,
      revenue: 0,
      quantity: 0,
    }));
  }

  if (period === "week") {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 6);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return {
        key: `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`,
        label: new Intl.DateTimeFormat("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        }).format(day),
        revenue: 0,
        quantity: 0,
      };
    });
  }

  if (period === "month") {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 29);
    return Array.from({ length: 30 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return {
        key: `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`,
        label: new Intl.DateTimeFormat("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        }).format(day),
        revenue: 0,
        quantity: 0,
      };
    });
  }

  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: `${month.getFullYear()}-${pad2(month.getMonth() + 1)}`,
      label: new Intl.DateTimeFormat("ru-RU", {
        month: "short",
      }).format(month),
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
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 6);
    return start;
  }
  if (period === "month") {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 29);
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth() - 11, 1);
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
  const points = buildBuckets(period, now);

  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from } },
    select: { soldAt: true, amount: true, quantity: true },
  });

  const index = new Map(points.map((point, i) => [point.key, i]));
  let totalRevenue = 0;
  let totalQuantity = 0;

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
  }

  return { period, points, totalRevenue, totalQuantity };
}
