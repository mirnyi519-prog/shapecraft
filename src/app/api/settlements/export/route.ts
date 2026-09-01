import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import {
  buildPartnerSalesCsv,
  partnerExportFilename,
} from "@/lib/settlement-export";

export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const period = request.nextUrl.searchParams.get("period");
    const settlementId = request.nextUrl.searchParams.get("settlementId");

    if (period === "current") {
      const sales = await prisma.sale.findMany({
        where: { settlementId: null },
        include: { product: { select: { name: true } } },
        orderBy: { soldAt: "asc" },
      });

      if (sales.length === 0) {
        return NextResponse.json(
          { error: "Нет продаж для экспорта" },
          { status: 400 },
        );
      }

      const totals = sales.reduce(
        (acc, sale) => ({
          quantity: acc.quantity + sale.quantity,
          amount: acc.amount + sale.amount,
          partnerShare: acc.partnerShare + sale.partnerShare,
        }),
        { quantity: 0, amount: 0, partnerShare: 0 },
      );

      const lastSettlement = await prisma.settlement.findFirst({
        orderBy: { createdAt: "desc" },
      });
      const periodLabel = lastSettlement
        ? `Текущий период после ${formatDate(lastSettlement.createdAt)}`
        : "Текущий период с начала учёта";

      const csv = buildPartnerSalesCsv({
        title: `ShapeCraft — ${periodLabel}`,
        sales: sales.map((sale) => ({
          soldAt: sale.soldAt,
          productName: sale.product.name,
          quantity: sale.quantity,
          amount: sale.amount,
          partnerShare: sale.partnerShare,
          note: sale.note,
        })),
        totals,
      });

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${partnerExportFilename("shapecraft-period")}"`,
        },
      });
    }

    if (settlementId) {
      const settlement = await prisma.settlement.findUnique({
        where: { id: settlementId },
        include: {
          sales: {
            include: { product: { select: { name: true } } },
            orderBy: { soldAt: "asc" },
          },
        },
      });

      if (!settlement) {
        return NextResponse.json({ error: "Расчёт не найден" }, { status: 404 });
      }

      const totals = settlement.sales.reduce(
        (acc, sale) => ({
          quantity: acc.quantity + sale.quantity,
          amount: acc.amount + sale.amount,
          partnerShare: acc.partnerShare + sale.partnerShare,
        }),
        { quantity: 0, amount: 0, partnerShare: 0 },
      );

      const csv = buildPartnerSalesCsv({
        title: `ShapeCraft — расчёт от ${formatDateTime(settlement.createdAt)}`,
        sales: settlement.sales.map((sale) => ({
          soldAt: sale.soldAt,
          productName: sale.product.name,
          quantity: sale.quantity,
          amount: sale.amount,
          partnerShare: sale.partnerShare,
          note: sale.note,
        })),
        totals,
      });

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${partnerExportFilename("shapecraft-settlement")}"`,
        },
      });
    }

    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка экспорта" }, { status: 500 });
  }
}
