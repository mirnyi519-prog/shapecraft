import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { SaleForm } from "@/components/forms";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function NewSalePage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const products = await prisma.product.findMany({
    where: { active: true, stock: { gt: 0 } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      listPrice: true,
      stock: true,
      imageUrl: true,
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Новая продажа</h1>
          <p className="text-[var(--muted)]">
            Укажите фактическую сумму — скидка посчитается автоматически
          </p>
        </div>
        <Card>
          <SaleForm products={products} />
        </Card>
      </div>
    </AppShell>
  );
}
