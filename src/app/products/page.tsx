import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  parseProductsView,
  productsViewTitle,
} from "@/components/app-nav-config";
import { ProductsBrowser } from "@/components/products-browser";
import { Button, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { listActiveCategories } from "@/lib/categories-data";
import { prisma } from "@/lib/db";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const admin = isAdmin(session.role);
  const params = await searchParams;
  let view = parseProductsView(params.view);
  if (view === "archive" && !admin) {
    view = "all";
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: admin ? undefined : { active: true },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      include: {
        categories: {
          include: {
            category: {
              select: { id: true, name: true, active: true, sortOrder: true },
            },
          },
        },
      },
    }),
    listActiveCategories(),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{productsViewTitle(view)}</h1>
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
          <ProductsBrowser
            isAdmin={admin}
            view={view}
            categories={categories.map((item) => ({ id: item.id, name: item.name }))}
            products={products.map((product) => ({
              id: product.id,
              name: product.name,
              description: product.description,
              imageUrl: product.imageUrl,
              listPrice: product.listPrice,
              costPrice: product.costPrice,
              stock: product.stock,
              active: product.active,
              categories: product.categories
                .map((item) => item.category)
                .filter((category) => category.active)
                .sort(
                  (a, b) =>
                    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"),
                )
                .map((category) => ({ id: category.id, name: category.name })),
            }))}
          />
        )}
      </div>
    </AppShell>
  );
}
