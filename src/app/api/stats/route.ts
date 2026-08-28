import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const pendingSales = await prisma.sale.findMany({
      where: { settlementId: null },
      include: {
        product: { select: { name: true } },
      },
      orderBy: { soldAt: "desc" },
    });

    const totals = pendingSales.reduce(
      (acc, sale) => ({
        count: acc.count + sale.quantity,
        totalRevenue: acc.totalRevenue + sale.amount,
        totalCost: acc.totalCost + sale.costTotal,
        totalProfit: acc.totalProfit + sale.profit,
        ownerShare: acc.ownerShare + sale.ownerShare,
        partnerShare: acc.partnerShare + sale.partnerShare,
      }),
      {
        count: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        ownerShare: 0,
        partnerShare: 0,
      },
    );

    const lastSettlement = await prisma.settlement.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const lowStock = await prisma.product.findMany({
      where: { active: true, stock: { lte: 2 } },
      orderBy: { stock: "asc" },
      take: 5,
    });

    const activeProducts = await prisma.product.count({
      where: { active: true },
    });

    return NextResponse.json({
      role: session.role,
      periodFrom: lastSettlement?.createdAt ?? null,
      totals,
      recentSales: pendingSales.slice(0, 8),
      lowStock,
      activeProducts,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
