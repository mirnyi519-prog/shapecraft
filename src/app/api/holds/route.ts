import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeHoldWhere, formatHoldPhone } from "@/lib/product-holds";

export async function GET() {
  try {
    await requireSession();
    const holds = await prisma.productHold.findMany({
      where: activeHoldWhere(),
      orderBy: { expiresAt: "asc" },
      include: { product: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      holds: holds.map((hold) => ({
        id: hold.id,
        productId: hold.productId,
        productName: hold.product.name,
        phone: formatHoldPhone(hold.phone),
        quantity: hold.quantity,
        expiresAt: hold.expiresAt.toISOString(),
        createdAt: hold.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки броней" }, { status: 500 });
  }
}
