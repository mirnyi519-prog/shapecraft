import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireSession();
    const receipts = await prisma.stockReceipt.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    });
    return NextResponse.json(receipts);
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
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = (await request.json()) as {
      productId?: string;
      quantity?: number;
      note?: string;
    };

    if (!body.productId) {
      return NextResponse.json({ error: "Выберите товар" }, { status: 400 });
    }

    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "Укажите количество не меньше 1" },
        { status: 400 },
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
    });

    if (!product || !product.active) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const receipt = await prisma.$transaction(async (tx) => {
      await tx.stockReceipt.create({
        data: {
          productId: product.id,
          quantity,
          note: body.note?.trim() || null,
          createdById: session.id,
        },
      });

      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stock: { increment: quantity } },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          stock: true,
        },
      });

      return updated;
    });

    return NextResponse.json(
      { product: receipt, quantity },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
