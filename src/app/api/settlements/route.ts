import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireSession();
    const settlements = await prisma.settlement.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { sales: true } },
      },
    });
    return NextResponse.json(settlements);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = (await request.json()) as { note?: string };
    const pendingSales = await prisma.sale.findMany({
      where: { settlementId: null },
      orderBy: { soldAt: "asc" },
    });

    if (pendingSales.length === 0) {
      return NextResponse.json(
        { error: "Нет продаж для расчёта" },
        { status: 400 },
      );
    }

    const totals = pendingSales.reduce(
      (acc, sale) => ({
        totalRevenue: acc.totalRevenue + sale.amount,
        totalCost: acc.totalCost + sale.costTotal,
        totalProfit: acc.totalProfit + sale.profit,
        ownerShare: acc.ownerShare + sale.ownerShare,
        partnerShare: acc.partnerShare + sale.partnerShare,
      }),
      {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        ownerShare: 0,
        partnerShare: 0,
      },
    );

    const settlement = await prisma.$transaction(async (tx) => {
      const created = await tx.settlement.create({
        data: {
          periodFrom: pendingSales[0].soldAt,
          periodTo: new Date(),
          totalRevenue: totals.totalRevenue,
          totalCost: totals.totalCost,
          totalProfit: totals.totalProfit,
          ownerShare: totals.ownerShare,
          partnerShare: totals.partnerShare,
          note: body.note?.trim() || null,
        },
      });

      await tx.sale.updateMany({
        where: { id: { in: pendingSales.map((sale) => sale.id) } },
        data: { settlementId: created.id },
      });

      return created;
    });

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка расчёта" }, { status: 500 });
  }
}
