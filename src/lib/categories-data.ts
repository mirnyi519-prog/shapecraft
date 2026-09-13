import { prisma } from "@/lib/db";
import type { CatalogCategory, CategoryOption } from "@/lib/categories";
import type { CatalogLine } from "@/lib/catalog-line";

export async function listAdminCategories(): Promise<
  (CategoryOption & { productCount: number })[]
> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    active: category.active,
    productCount: category._count.products,
  }));
}

export async function listActiveCategories(): Promise<CatalogCategory[]> {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });

  return categories;
}

/** Активные разделы, в которых есть товары выбранного направления витрины. */
export async function listActiveCategoriesForCatalogLine(
  catalogLine: CatalogLine,
): Promise<CatalogCategory[]> {
  const categories = await prisma.category.findMany({
    where: {
      active: true,
      products: {
        some: {
          product: {
            active: true,
            catalogLine,
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });

  return categories;
}

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      active: true,
    },
  });

  return categories;
}

export async function syncProductCategories(
  productId: string,
  categoryIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({ where: { productId } });

    if (categoryIds.length === 0) {
      return;
    }

    const existing = await tx.category.findMany({
      where: { id: { in: categoryIds }, active: true },
      select: { id: true },
    });

    if (existing.length === 0) {
      return;
    }

    await tx.productCategory.createMany({
      data: existing.map((category) => ({
        productId,
        categoryId: category.id,
      })),
    });
  });
}
