import { ProductCatalog } from "@/components/product-catalog";
import { PublicShell } from "@/components/public-shell";
import { prisma } from "@/lib/db";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ stock: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      listPrice: true,
      stock: true,
    },
  });

  return (
    <PublicShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Каталог игрушек</h1>
          <p className="text-[var(--muted)]">
            Актуальные цены и остатки в пекарне
          </p>
        </div>
        <ProductCatalog products={products} />
      </div>
    </PublicShell>
  );
}
