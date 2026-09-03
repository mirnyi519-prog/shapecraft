import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCategoryIds } from "@/lib/categories";
import { syncProductCategories } from "@/lib/categories-data";
import { parseOptionalNumber } from "@/lib/product-specs";
import { parseOptionalPrice } from "@/lib/pricing";

export async function GET() {
  try {
    await requireSession();
    const products = await prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { sales: true } },
        categories: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, active: true },
            },
          },
        },
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
      listPrice?: number | null;
      stock?: number;
      weightGrams?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
      depthMm?: number | null;
      categoryIds?: string[];
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

    const listPrice = parseOptionalPrice(body.listPrice);
    const categoryIds = parseCategoryIds(body.categoryIds);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: body.name!.trim(),
          description: body.description?.trim() || null,
          imageUrl: body.imageUrl || null,
          costPrice: Number(body.costPrice),
          listPrice,
          stock: Number(body.stock ?? 0),
          weightGrams: parseOptionalNumber(body.weightGrams),
          widthMm: parseOptionalNumber(body.widthMm),
          heightMm: parseOptionalNumber(body.heightMm),
          depthMm: parseOptionalNumber(body.depthMm),
        },
      });

      if (listPrice !== null) {
        await tx.priceHistory.create({
          data: {
            productId: created.id,
            oldPrice: null,
            newPrice: listPrice,
            changedById: session.id,
          },
        });
      }

      return created;
    });

    await syncProductCategories(product.id, categoryIds);

    const withCategories = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    return NextResponse.json(withCategories, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("product create", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
