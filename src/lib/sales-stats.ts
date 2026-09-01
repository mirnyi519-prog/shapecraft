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
