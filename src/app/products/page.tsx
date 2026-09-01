import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProductsBrowser } from "@/components/products-browser";
import { Button, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ProductsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const admin = isAdmin(session.role);

  const products = await prisma.product.findMany({
    where: admin ? undefined : { active: true },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Товары</h1>
            <p className="text-[var(--muted)]">
              Сувениры и остатки. Красные карточки — без прайса.
            </p>
          </div>
          {admin ? (
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
          <ProductsBrowser products={products} isAdmin={admin} />
        )}
      </div>
    </AppShell>
  );
}
