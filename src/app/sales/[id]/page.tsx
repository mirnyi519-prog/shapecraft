import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { SaleForm } from "@/components/forms";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSalePage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      product: true,
      settlement: { select: { id: true } },
    },
  });

  if (!sale) {
    notFound();
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { active: true },
        { id: sale.productId },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      listPrice: true,
      stock: true,
      imageUrl: true,
    },
  });

  // В списке остаток «как будто продажа ещё не списана» для текущего товара
  const productsForForm = products.map((product) =>
    product.id === sale.productId
      ? { ...product, stock: product.stock + sale.quantity }
      : product,
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/sales"
            className="text-sm text-[var(--muted)] hover:underline"
          >
            ← К продажам
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Редактирование продажи</h1>
          <p className="text-[var(--muted)]">{sale.product.name}</p>
        </div>
        <Card>
          <SaleForm
            products={productsForForm}
            initial={{
              id: sale.id,
              productId: sale.productId,
              quantity: sale.quantity,
              amount: sale.amount,
              note: sale.note ?? "",
              settled: Boolean(sale.settlementId),
            }}
          />
        </Card>
      </div>
    </AppShell>
  );
}
