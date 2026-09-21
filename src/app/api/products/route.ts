import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCategoryIds } from "@/lib/categories";
import { syncProductCategories } from "@/lib/categories-data";
import { parseCatalogLine } from "@/lib/catalog-line";
import { parseZeroStockMode } from "@/lib/buy-intent";
import { parseOptionalNumber } from "@/lib/product-specs";
import { parseOptionalPrice } from "@/lib/pricing";
import {
  normalizeImageUrls,
  syncProductImages,
} from "@/lib/product-images";
import { resolveSuggestedPackagingId } from "@/lib/packaging-data";
import { notifyTelegramNewProduct } from "@/lib/telegram";

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
      imageUrls?: string[];
      costPrice?: number;
      listPrice?: number | null;
      stock?: number;
      weightGrams?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
      depthMm?: number | null;
      catalogLine?: string;
      zeroStockMode?: string;
      categoryIds?: string[];
      packagingId?: string | null;
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
    const catalogLine = parseCatalogLine(body.catalogLine);
    const zeroStockMode = parseZeroStockMode(body.zeroStockMode);
    const imageUrls = Object.prototype.hasOwnProperty.call(body, "imageUrls")
      ? normalizeImageUrls(body.imageUrls)
      : normalizeImageUrls(body.imageUrl ? [body.imageUrl] : []);

    const weightGrams = parseOptionalNumber(body.weightGrams);
    const widthMm = parseOptionalNumber(body.widthMm);
    const heightMm = parseOptionalNumber(body.heightMm);
    const depthMm = parseOptionalNumber(body.depthMm);

    let packagingId =
      typeof body.packagingId === "string" && body.packagingId.trim()
        ? body.packagingId.trim()
        : body.packagingId === null
          ? null
          : undefined;

    if (packagingId === undefined || packagingId === "") {
      const suggested = await resolveSuggestedPackagingId({
        weightGrams,
        widthMm,
        heightMm,
        depthMm,
      });
      packagingId = suggested.packagingId;
    }

    if (packagingId) {
      const pack = await prisma.packaging.findUnique({
        where: { id: packagingId },
        select: { id: true },
      });
      if (!pack) {
        return NextResponse.json({ error: "Упаковка не найдена" }, { status: 400 });
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: body.name!.trim(),
          description: body.description?.trim() || null,
          imageUrl: imageUrls[0] ?? null,
          costPrice: Number(body.costPrice),
          listPrice,
          stock: Number(body.stock ?? 0),
          catalogLine,
          zeroStockMode,
          weightGrams,
          widthMm,
          heightMm,
          depthMm,
          packagingId: packagingId ?? null,
        },
      });

      await syncProductImages(tx, created.id, imageUrls);

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

    notifyTelegramNewProduct({
      name: product.name,
      imageUrl: imageUrls[0] ?? product.imageUrl,
      listPrice: product.listPrice,
      stock: product.stock,
      catalogLine: product.catalogLine,
    });

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
