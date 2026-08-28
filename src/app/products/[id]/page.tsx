import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { ProductForm } from "@/components/forms";
import { formatDateTime, formatRub } from "@/lib/calculations";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { soldAt: "desc" },
        take: 10,
      },
    },
  });

  if (!product) {
    notFound();
  }

  if (session.role !== "admin") {
    redirect("/products");
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card title="Редактирование">
          <ProductForm
            canEditCost
            initial={{
              id: product.id,
              name: product.name,
              description: product.description ?? "",
              imageUrl: product.imageUrl ?? "",
              costPrice: String(product.costPrice),
              listPrice: String(product.listPrice),
              stock: String(product.stock),
            }}
          />
        </Card>
        <Card title="Последние продажи">
          <div className="mb-4">
            <Badge tone={product.stock <= 2 ? "warning" : "success"}>
              Остаток: {product.stock} шт
            </Badge>
          </div>
          {product.sales.length === 0 ? (
            <p className="text-[var(--muted)]">Продаж пока нет.</p>
          ) : (
            <div className="space-y-3">
              {product.sales.map((sale) => (
                <div
                  key={sale.id}
                  className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{formatDateTime(sale.soldAt)}</span>
                    <span className="font-semibold">{formatRub(sale.amount)}</span>
                  </div>
                  <p className="mt-1 text-[var(--muted)]">
                    {sale.quantity} шт · прибыль {formatRub(sale.profit)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
