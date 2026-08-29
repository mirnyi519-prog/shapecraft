import { NextRequest, NextResponse } from "next/server";
import {
  getOwnerSplitPercent,
  requireSession,
} from "@/lib/auth";
import { calculateSaleSplit } from "@/lib/calculations";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireSession();
    const sales = await prisma.sale.findMany({
      orderBy: { soldAt: "desc" },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        settlement: { select: { id: true, createdAt: true } },
      },
    });
    return NextResponse.json(sales);
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
    const body = (await request.json()) as {
      productId?: string;
      quantity?: number;
      amount?: number;
      note?: string;
      soldAt?: string;
    };

    if (!body.productId) {
      return NextResponse.json({ error: "Выберите товар" }, { status: 400 });
    }

    const quantity = Number(body.quantity ?? 1);
    const amount = Number(body.amount);

    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ error: "Некорректное количество" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Укажите сумму продажи" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
    });

    if (!product || !product.active) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    if (product.listPrice === null || product.listPrice === undefined) {
      return NextResponse.json(
        { error: "Нельзя продать товар без цены в прайсе" },
        { status: 400 },
      );
    }

    if (product.stock < quantity) {
      return NextResponse.json(
        { error: `Недостаточно остатка (есть ${product.stock})` },
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
      const created = await tx.sale.create({
        data: {
          productId: product.id,
          quantity,
          amount: split.amount,
          costTotal: split.costTotal,
          profit: split.profit,
          ownerShare: split.ownerShare,
          partnerShare: split.partnerShare,
          note: body.note?.trim() || null,
          soldAt: body.soldAt ? new Date(body.soldAt) : new Date(),
          createdById: session.id,
        },
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      });

      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: quantity } },
      });

      return created;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
