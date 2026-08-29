import { NextRequest, NextResponse } from "next/server";
import {
  getOwnerSplitPercent,
  requireSession,
} from "@/lib/auth";
import { calculateSaleSplit } from "@/lib/calculations";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, name: true, imageUrl: true, listPrice: true, stock: true },
        },
        settlement: { select: { id: true, createdAt: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Продажа не найдена" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = (await request.json()) as {
      productId?: string;
      quantity?: number;
      amount?: number;
      note?: string;
      soldAt?: string;
    };

    const existing = await prisma.sale.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Продажа не найдена" }, { status: 404 });
    }

    // Закрытый период: только комментарий
    if (existing.settlementId) {
      const sale = await prisma.sale.update({
        where: { id },
        data: {
          note:
            body.note !== undefined
              ? body.note.trim() || null
              : existing.note,
        },
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      });
      return NextResponse.json(sale);
    }

    const productId = body.productId ?? existing.productId;
    const quantity = Number(body.quantity ?? existing.quantity);
    const amount = Number(body.amount ?? existing.amount);

    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ error: "Некорректное количество" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Укажите сумму продажи" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || (!product.active && product.id !== existing.productId)) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const availableStock =
      product.stock +
      (product.id === existing.productId ? existing.quantity : 0);

    if (availableStock < quantity) {
      return NextResponse.json(
        { error: `Недостаточно остатка (доступно ${availableStock})` },
        { status: 400 },
      );
    }

    const ownerSplitPercent = await getOwnerSplitPercent();
    const split = calculateSaleSplit(
      product.costPrice,
      quantity,
      amount,
      ownerSplitPercent,
    );

    const sale = await prisma.$transaction(async (tx) => {
      // вернуть остаток старой продажи
      await tx.product.update({
        where: { id: existing.productId },
        data: { stock: { increment: existing.quantity } },
      });

      // списать новый остаток
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: quantity } },
      });

      return tx.sale.update({
        where: { id },
        data: {
          productId: product.id,
          quantity,
          amount: split.amount,
          costTotal: split.costTotal,
          profit: split.profit,
          ownerShare: split.ownerShare,
          partnerShare: split.partnerShare,
          note:
            body.note !== undefined
              ? body.note.trim() || null
              : existing.note,
          soldAt: body.soldAt ? new Date(body.soldAt) : existing.soldAt,
        },
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      });
    });

    return NextResponse.json(sale);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("sale patch error", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const existing = await prisma.sale.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Продажа не найдена" }, { status: 404 });
    }
    if (existing.settlementId) {
      return NextResponse.json(
        { error: "Нельзя удалить продажу из закрытого периода" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: existing.productId },
        data: { stock: { increment: existing.quantity } },
      });
      await tx.sale.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
