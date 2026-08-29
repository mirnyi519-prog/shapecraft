import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { SaleForm } from "@/components/forms";
import { getSession } from "@/lib/auth";
import { hasListPrice } from "@/lib/pricing";
import { prisma } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProductSalePage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || !product.active) {
    notFound();
  }

  if (!hasListPrice(product.listPrice)) {
    redirect(`/products/${product.id}`);
  }

  if (product.stock < 1) {
    redirect(`/products/${product.id}`);
  }

  const products = [
    {
      id: product.id,
      name: product.name,
      listPrice: product.listPrice,
      stock: product.stock,
      imageUrl: product.imageUrl,
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <Link href="/products" className="text-sm text-[var(--muted)] hover:underline">
            ← К товарам
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Продажа</h1>
          <p className="text-[var(--muted)]">{product.name}</p>
        </div>
        <Card>
          <SaleForm
            products={products}
            defaultProductId={product.id}
            redirectTo="/products"
          />
        </Card>
      </div>
    </AppShell>
  );
}
