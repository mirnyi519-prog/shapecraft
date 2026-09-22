import { prisma } from "@/lib/db";
import { getTopSoldProducts } from "@/lib/sales-stats";
import type { CatalogCategory } from "@/lib/categories";
import type { CatalogLine } from "@/lib/catalog-line";
import type { ZeroStockMode } from "@/lib/buy-intent";
import { parseZeroStockMode } from "@/lib/buy-intent";
import { resolveProductImageList } from "@/lib/product-images";

export const catalogProductSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  listPrice: true,
  stock: true,
  catalogLine: true,
  zeroStockMode: true,
  weightGrams: true,
  widthMm: true,
  heightMm: true,
  depthMm: true,
  createdAt: true,
  viewCount: true,
  images: {
    orderBy: { sortOrder: "asc" as const },
    select: { url: true, sortOrder: true },
  },
  categories: {
    include: {
      category: {
        select: { id: true, name: true, slug: true, active: true, sortOrder: true },
      },
    },
  },
} as const;

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  listPrice: number | null;
  stock: number;
  catalogLine?: string;
  zeroStockMode: ZeroStockMode;
  weightGrams: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  createdAt?: string;
  viewCount?: number;
  costPrice?: number;
  categories: CatalogCategory[];
};

type DbProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  listPrice: number | null;
  stock: number;
  catalogLine: string;
  zeroStockMode: string;
  weightGrams: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  createdAt: Date;
  viewCount: number;
  images?: { url: string; sortOrder: number }[];
  categories: {
    category: {
      id: string;
      name: string;
      slug: string;
      active: boolean;
      sortOrder: number;
    };
  }[];
};

/** Активные товары направления, кроме скрытых при нулевом остатке. */
function storefrontWhere(catalogLine?: CatalogLine) {
  return {
    active: true as const,
    ...(catalogLine ? { catalogLine } : {}),
    NOT: {
      AND: [{ stock: { lte: 0 } }, { zeroStockMode: "hide" }],
    },
  };
}

function mapProduct(product: DbProduct): CatalogProduct {
  const imageUrls = resolveProductImageList(product);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: imageUrls[0] ?? product.imageUrl,
    imageUrls,
    listPrice: product.listPrice,
    stock: product.stock,
    catalogLine: product.catalogLine,
    zeroStockMode: parseZeroStockMode(product.zeroStockMode),
    weightGrams: product.weightGrams,
    widthMm: product.widthMm,
    heightMm: product.heightMm,
    depthMm: product.depthMm,
    createdAt: product.createdAt?.toISOString(),
    viewCount: product.viewCount,
    categories: product.categories
      .map((item) => item.category)
      .filter((category) => category.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"))
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })),
  };
}

export function stockBadgeLabel(product: {
  stock: number;
  zeroStockMode?: ZeroStockMode | string;
}): string {
  if (product.stock > 0) {
    return `${product.stock} шт`;
  }
  const mode = parseZeroStockMode(product.zeroStockMode);
  if (mode === "soon") {
    return "Скоро";
  }
  return "Нет в наличии";
}

export function stockBadgeShort(product: {
  stock: number;
  zeroStockMode?: ZeroStockMode | string;
}): string {
  if (product.stock > 0) {
    return `${product.stock} шт`;
  }
  const mode = parseZeroStockMode(product.zeroStockMode);
  return mode === "soon" ? "Скоро" : "Нет";
}

/** Текст основной кнопки в карточке товара на витрине. */
export function storefrontCtaLabel(product: {
  stock: number;
  zeroStockMode?: ZeroStockMode | string;
}): string {
  if (product.stock > 0) {
    return "Купить";
  }
  const mode = parseZeroStockMode(product.zeroStockMode);
  return mode === "soon" ? "Предзаказ" : "Уточнить";
}

export async function getActiveCatalogProducts(
  catalogLine?: CatalogLine,
): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: storefrontWhere(catalogLine),
    orderBy: [{ stock: "desc" }, { name: "asc" }],
    select: catalogProductSelect,
  });

  return products.map(mapProduct);
}

export async function getNewCatalogProducts(
  limit = 6,
  catalogLine?: CatalogLine,
): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: storefrontWhere(catalogLine),
    orderBy: { createdAt: "desc" },
    take: limit,
    select: catalogProductSelect,
  });

  return products.map(mapProduct);
}

export async function getPopularCatalogProducts(
  limit = 6,
  catalogLine?: CatalogLine,
): Promise<CatalogProduct[]> {
  const topSold = await getTopSoldProducts(limit);
  const soldIds = topSold.map((item) => item.productId);

  const soldProducts =
    soldIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: { in: soldIds },
            ...storefrontWhere(catalogLine),
          },
          select: catalogProductSelect,
        })
      : [];

  const soldMap = new Map(soldProducts.map((item) => [item.id, mapProduct(item)]));
  const ordered = soldIds
    .map((id) => soldMap.get(id))
    .filter((item): item is CatalogProduct => Boolean(item));

  if (ordered.length >= limit) {
    return ordered.slice(0, limit);
  }

  const excludeIds = ordered.map((item) => item.id);
  const byViews = await prisma.product.findMany({
    where: {
      ...storefrontWhere(catalogLine),
      id: { notIn: excludeIds },
    },
    orderBy: [{ viewCount: "desc" }, { name: "asc" }],
    take: limit - ordered.length,
    select: catalogProductSelect,
  });

  return [...ordered, ...byViews.map(mapProduct)];
}
