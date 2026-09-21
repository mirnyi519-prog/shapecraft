import { prisma } from "@/lib/db";
import type { PackagingOption } from "@/lib/packaging";
import { suggestPackagingCode } from "@/lib/packaging";
import type { ProductSpecsInput } from "@/lib/product-specs";

export async function listPackaging(admin = true): Promise<PackagingOption[]> {
  const rows = await prisma.packaging.findMany({
    where: admin ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    boxWidthMm: row.boxWidthMm,
    boxHeightMm: row.boxHeightMm,
    boxDepthMm: row.boxDepthMm,
    stock: row.stock,
    sortOrder: row.sortOrder,
    active: row.active,
    productCount: row._count.products,
  }));
}

export async function findPackagingIdByCode(code: string): Promise<string | null> {
  const row = await prisma.packaging.findUnique({
    where: { code },
    select: { id: true, active: true },
  });
  if (!row || !row.active) {
    return null;
  }
  return row.id;
}

export async function resolveSuggestedPackagingId(
  specs: ProductSpecsInput,
): Promise<{ code: string; packagingId: string | null }> {
  const code = suggestPackagingCode(specs);
  const packagingId = await findPackagingIdByCode(code);
  return { code, packagingId };
}
