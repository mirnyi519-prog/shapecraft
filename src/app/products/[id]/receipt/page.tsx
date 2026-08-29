import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { ReceiptForm } from "@/components/forms";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProductReceiptPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/products");
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || !product.active) {
    notFound();
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
          <h1 className="mt-2 text-2xl font-bold">Поставка</h1>
          <p className="text-[var(--muted)]">{product.name}</p>
        </div>
        <Card>
          <ReceiptForm
            products={products}
            defaultProductId={product.id}
            redirectTo="/products"
          />
        </Card>
      </div>
    </AppShell>
  );
}
