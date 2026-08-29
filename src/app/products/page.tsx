import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProductPhoto } from "@/components/product-photo";
import { Badge, Button, Card } from "@/components/ui";
import { formatRub } from "@/lib/calculations";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ProductsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Товары</h1>
            <p className="text-[var(--muted)]">Каталог игрушек и остатки</p>
          </div>
          {session.role === "admin" ? (
            <Link href="/products/new" className="w-full sm:w-auto">
              <Button className="min-h-11 w-full sm:w-auto">+ Новый товар</Button>
            </Link>
          ) : null}
        </div>

        {products.length === 0 ? (
          <Card>
            <p className="text-[var(--muted)]">Каталог пуст. Добавьте первый товар.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card>
                  <div className="space-y-4">
                    <ProductPhoto
                      src={product.imageUrl}
                      alt={product.name}
                      frameClassName="aspect-[4/3] h-auto min-h-40"
                    />
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg font-semibold">{product.name}</h2>
                        <Badge tone={product.stock <= 2 ? "warning" : "success"}>
                          {product.stock} шт
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Прайс {formatRub(product.listPrice)}
                        {session.role === "admin"
                          ? ` · себестоимость ${formatRub(product.costPrice)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
