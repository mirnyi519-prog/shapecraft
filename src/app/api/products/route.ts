import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireSession();
    const products = await prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { sales: true } },
      },
    });
    return NextResponse.json(products);
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
      name?: string;
      description?: string;
      imageUrl?: string;
      costPrice?: number;
      listPrice?: number;
      stock?: number;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Укажите название" }, { status: 400 });
    }

    if (body.costPrice === undefined || !Number.isFinite(Number(body.costPrice))) {
      return NextResponse.json(
        { error: "Укажите себестоимость" },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        imageUrl: body.imageUrl || null,
        costPrice: Number(body.costPrice),
        listPrice: Number(body.listPrice ?? 0),
        stock: Number(body.stock ?? 0),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
