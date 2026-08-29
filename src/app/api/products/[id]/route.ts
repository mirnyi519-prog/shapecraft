import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOptionalPrice } from "@/lib/pricing";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireSession();
    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { soldAt: "desc" },
          take: 20,
        },
        priceHistory: {
          orderBy: { changedAt: "desc" },
          take: 50,
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      imageUrl?: string;
      costPrice?: number;
      listPrice?: number | null;
      stock?: number;
      active?: boolean;
    };

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const listPriceProvided = Object.prototype.hasOwnProperty.call(body, "listPrice");
    const nextListPrice = listPriceProvided
      ? parseOptionalPrice(body.listPrice)
      : existing.listPrice;

    const priceChanged =
      listPriceProvided &&
      (existing.listPrice ?? null) !== (nextListPrice ?? null);

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description.trim() || null }
            : {}),
          ...(body.imageUrl !== undefined
            ? { imageUrl: body.imageUrl || null }
            : {}),
          ...(body.costPrice !== undefined
            ? { costPrice: Number(body.costPrice) }
            : {}),
          ...(listPriceProvided ? { listPrice: nextListPrice } : {}),
          ...(body.stock !== undefined ? { stock: Number(body.stock) } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
      });

      if (priceChanged) {
        await tx.priceHistory.create({
          data: {
            productId: id,
            oldPrice: existing.listPrice,
            newPrice: nextListPrice,
            changedById: session.id,
          },
        });
      }

      return updated;
    });

    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("product patch", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await context.params;
    await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
