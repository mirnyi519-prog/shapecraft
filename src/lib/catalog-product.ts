import { prisma } from "@/lib/db";
import { getTopSoldProducts } from "@/lib/sales-stats";

export const catalogProductSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  listPrice: true,
  stock: true,
  weightGrams: true,
  widthMm: true,
  heightMm: true,
  depthMm: true,
  createdAt: true,
  viewCount: true,
} as const;

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  listPrice: number | null;
  stock: number;
  weightGrams: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  createdAt?: string;
  viewCount?: number;
  costPrice?: number;
};

type DbProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  listPrice: number | null;
  stock: number;
  weightGrams: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  createdAt: Date;
  viewCount: number;
};

function mapProduct(product: DbProduct): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    listPrice: product.listPrice,
    stock: product.stock,
    weightGrams: product.weightGrams,
    widthMm: product.widthMm,
    heightMm: product.heightMm,
    depthMm: product.depthMm,
    createdAt: product.createdAt?.toISOString(),
    viewCount: product.viewCount,
  };
}

export async function getActiveCatalogProducts(): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ stock: "desc" }, { name: "asc" }],
    select: catalogProductSelect,
  });

  return products.map(mapProduct);
}

export async function getNewCatalogProducts(limit = 6): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: catalogProductSelect,
  });

  return products.map(mapProduct);
}

export async function getPopularCatalogProducts(
  limit = 6,
): Promise<CatalogProduct[]> {
  const topSold = await getTopSoldProducts(limit);
  const soldIds = topSold.map((item) => item.productId);

  const soldProducts =
    soldIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: soldIds }, active: true },
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
      active: true,
      id: { notIn: excludeIds },
    },
    orderBy: [{ viewCount: "desc" }, { name: "asc" }],
    take: limit - ordered.length,
    select: catalogProductSelect,
  });

  return [...ordered, ...byViews.map(mapProduct)];
}
