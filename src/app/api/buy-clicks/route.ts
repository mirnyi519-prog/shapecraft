import { NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Сброс всей истории кликов «Купить» и счётчиков на товарах. */
export async function DELETE() {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const [clicks] = await prisma.$transaction([
      prisma.productBuyClick.deleteMany({}),
      prisma.product.updateMany({
        data: { buyClickCount: 0 },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      deletedClicks: clicks.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("buy-clicks reset", error);
    return NextResponse.json({ error: "Ошибка сброса" }, { status: 500 });
  }
}
