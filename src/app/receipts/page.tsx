import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { Card } from "@/components/ui";
import { ReceiptForm } from "@/components/forms";
import { formatDateTime } from "@/lib/calculations";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ReceiptsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const [products, receipts] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        listPrice: true,
        stock: true,
        imageUrl: true,
      },
    }),
    prisma.stockReceipt.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        product: { select: { name: true, imageUrl: true } },
      },
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Приход</h1>
          <p className="text-[var(--muted)]">
            Допечатали партию — добавьте к остатку существующего товара
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card title="Новый приход">
            <ReceiptForm products={products} />
          </Card>

          <Card title="Журнал приходов">
            {receipts.length === 0 ? (
              <p className="text-[var(--muted)]">Приходов пока нет.</p>
            ) : (
              <div className="space-y-3">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <ProductThumb
                        src={receipt.product.imageUrl}
                        alt={receipt.product.name}
                        size={44}
                      />
                      <div>
                        <p className="font-medium">{receipt.product.name}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {formatDateTime(receipt.createdAt)} · +{receipt.quantity} шт
                        </p>
                        {receipt.note ? (
                          <p className="text-sm text-[var(--muted)]">{receipt.note}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
