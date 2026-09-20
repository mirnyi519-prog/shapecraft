import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCategoryIds } from "@/lib/categories";
import { syncProductCategories } from "@/lib/categories-data";
import { isCatalogLine } from "@/lib/catalog-line";
import { isZeroStockMode } from "@/lib/buy-intent";
import { parseOptionalNumber } from "@/lib/product-specs";
import { parseOptionalPrice } from "@/lib/pricing";
import {
  normalizeImageUrls,
  syncProductImages,
} from "@/lib/product-images";

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
        images: {
          orderBy: { sortOrder: "asc" },
        },
        categories: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, active: true },
            },
          },
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
      imageUrls?: string[];
      costPrice?: number;
      listPrice?: number | null;
      stock?: number;
      active?: boolean;
      weightGrams?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
      depthMm?: number | null;
      catalogLine?: string;
      zeroStockMode?: string;
      categoryIds?: string[];
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

    const categoryIdsProvided = Object.prototype.hasOwnProperty.call(
      body,
      "categoryIds",
    );
    const categoryIds = categoryIdsProvided
      ? parseCategoryIds(body.categoryIds)
      : null;

    const catalogLineProvided = Object.prototype.hasOwnProperty.call(
      body,
      "catalogLine",
    );
    if (catalogLineProvided && !isCatalogLine(body.catalogLine)) {
      return NextResponse.json(
        { error: "Некорректное направление витрины" },
        { status: 400 },
      );
    }

    const zeroStockModeProvided = Object.prototype.hasOwnProperty.call(
      body,
      "zeroStockMode",
    );
    if (zeroStockModeProvided && !isZeroStockMode(body.zeroStockMode)) {
      return NextResponse.json(
        { error: "Некорректный режим нулевого остатка" },
        { status: 400 },
      );
    }

    const imageUrlsProvided = Object.prototype.hasOwnProperty.call(
      body,
      "imageUrls",
    );
    const imageUrlProvided = Object.prototype.hasOwnProperty.call(
      body,
      "imageUrl",
    );
    const nextImageUrls = imageUrlsProvided
      ? normalizeImageUrls(body.imageUrls)
      : imageUrlProvided
        ? normalizeImageUrls(body.imageUrl ? [body.imageUrl] : [])
        : null;

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description.trim() || null }
            : {}),
          ...(nextImageUrls === null && body.imageUrl !== undefined
            ? { imageUrl: body.imageUrl || null }
            : {}),
          ...(body.costPrice !== undefined
            ? { costPrice: Number(body.costPrice) }
            : {}),
          ...(listPriceProvided ? { listPrice: nextListPrice } : {}),
          ...(body.stock !== undefined ? { stock: Number(body.stock) } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          ...(catalogLineProvided ? { catalogLine: body.catalogLine } : {}),
          ...(zeroStockModeProvided
            ? { zeroStockMode: body.zeroStockMode }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "weightGrams")
            ? { weightGrams: parseOptionalNumber(body.weightGrams) }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "widthMm")
            ? { widthMm: parseOptionalNumber(body.widthMm) }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "heightMm")
            ? { heightMm: parseOptionalNumber(body.heightMm) }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "depthMm")
            ? { depthMm: parseOptionalNumber(body.depthMm) }
            : {}),
        },
      });

      if (nextImageUrls !== null) {
        await syncProductImages(tx, id, nextImageUrls);
      }

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

    if (categoryIds) {
      await syncProductCategories(id, categoryIds);
    }

    const withCategories = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    return NextResponse.json(withCategories);
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
