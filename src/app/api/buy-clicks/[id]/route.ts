import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { isBuyClickOutcome } from "@/lib/buy-intent";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      outcome?: string | null;
      outcomeNote?: string | null;
    };

    const existing = await prisma.productBuyClick.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Клик не найден" }, { status: 404 });
    }

    const clearOutcome = body.outcome === null || body.outcome === "";
    if (!clearOutcome && body.outcome !== undefined && !isBuyClickOutcome(body.outcome)) {
      return NextResponse.json({ error: "Некорректный исход" }, { status: 400 });
    }

    const updated = await prisma.productBuyClick.update({
      where: { id },
      data: {
        ...(body.outcome !== undefined
          ? clearOutcome
            ? { outcome: null, outcomeAt: null }
            : { outcome: body.outcome, outcomeAt: new Date() }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "outcomeNote")
          ? { outcomeNote: body.outcomeNote?.trim() || null }
          : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
