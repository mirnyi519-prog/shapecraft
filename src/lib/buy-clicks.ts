import { prisma } from "@/lib/db";
import { parseUserAgent } from "@/lib/visits";

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number): Date {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

export async function getBuyClickStats() {
  const today = startOfToday();
  const weekStart = daysAgo(7);

  const [totalClicks, clicksToday, clicksWeek, uniqueIps, uniqueVisitors, topProducts, recent] =
    await Promise.all([
      prisma.productBuyClick.count(),
      prisma.productBuyClick.count({ where: { clickedAt: { gte: today } } }),
      prisma.productBuyClick.count({ where: { clickedAt: { gte: weekStart } } }),
      prisma.productBuyClick.groupBy({
        by: ["ipAddress"],
        _count: { _all: true },
      }),
      prisma.productBuyClick.groupBy({
        by: ["visitorId"],
        where: { visitorId: { not: null } },
        _count: { _all: true },
      }),
      prisma.product.findMany({
        where: { buyClickCount: { gt: 0 } },
        orderBy: [{ buyClickCount: "desc" }, { name: "asc" }],
        take: 20,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          buyClickCount: true,
          viewCount: true,
          active: true,
        },
      }),
      prisma.productBuyClick.findMany({
        orderBy: { clickedAt: "desc" },
        take: 40,
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true },
          },
        },
      }),
    ]);

  const byIp = await prisma.productBuyClick.groupBy({
    by: ["ipAddress"],
    _count: { ipAddress: true },
    _max: { clickedAt: true },
    orderBy: { _count: { ipAddress: "desc" } },
    take: 15,
  });

  const ipRows = byIp.map((row) => ({
    ipAddress: row.ipAddress,
    clickCount: row._count.ipAddress,
    lastClickAt: row._max.clickedAt?.toISOString() ?? null,
  }));

  return {
    totalClicks,
    clicksToday,
    clicksWeek,
    uniqueIps: uniqueIps.length,
    uniqueVisitors: uniqueVisitors.length,
    topProducts,
    recent: recent.map((row) => ({
      id: row.id,
      productId: row.productId,
      productName: row.product.name,
      productImageUrl: row.product.imageUrl,
      ipAddress: row.ipAddress,
      visitorId: row.visitorId,
      clickedAt: row.clickedAt.toISOString(),
      device: parseUserAgent(row.userAgent).summary,
    })),
    byIp: ipRows,
  };
}
