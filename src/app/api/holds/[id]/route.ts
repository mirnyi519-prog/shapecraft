import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeHoldWhere } from "@/lib/product-holds";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireSession();
    const { id } = await context.params;
    const hold = await prisma.productHold.findFirst({
      where: { id, ...activeHoldWhere() },
    });
    if (!hold) {
      return NextResponse.json({ error: "Бронь уже не активна" }, { status: 404 });
    }

    await prisma.productHold.update({
      where: { id },
      data: { releasedAt: new Date(), releaseReason: "cancelled" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Не удалось снять бронь" }, { status: 500 });
  }
}
