import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime, formatRub } from "@/lib/calculations";
import { getSession } from "@/lib/auth";
import { selfShareLabel } from "@/lib/labels";
import { prisma } from "@/lib/db";

export default async function SalesPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const sales = await prisma.sale.findMany({
    orderBy: { soldAt: "desc" },
    include: {
      product: { select: { name: true, imageUrl: true } },
      settlement: { select: { id: true, createdAt: true } },
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Продажи</h1>
            <p className="text-[var(--muted)]">Журнал всех продаж</p>
          </div>
          <Link href="/sales/new">
            <Button>+ Продажа</Button>
          </Link>
        </div>

        <Card>
          {sales.length === 0 ? (
            <p className="text-[var(--muted)]">Продаж пока нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="px-3 py-3">Дата</th>
                    <th className="px-3 py-3">Товар</th>
                    <th className="px-3 py-3">Кол-во</th>
                    <th className="px-3 py-3">Сумма</th>
                    {session.role === "admin" ? (
                      <th className="px-3 py-3">Себест.</th>
                    ) : null}
                    <th className="px-3 py-3">{selfShareLabel(session.role)}</th>
                    <th className="px-3 py-3">Комментарий</th>
                    <th className="px-3 py-3">Период</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-3 whitespace-nowrap">
                        {formatDateTime(sale.soldAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb
                            src={sale.product.imageUrl}
                            alt={sale.product.name}
                            size={44}
                          />
                          <span className="font-medium">{sale.product.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">{sale.quantity}</td>
                      <td className="px-3 py-3 font-medium">{formatRub(sale.amount)}</td>
                      {session.role === "admin" ? (
                        <td className="px-3 py-3">{formatRub(sale.costTotal)}</td>
                      ) : null}
                      <td className="px-3 py-3">
                        {formatRub(
                          session.role === "admin"
                            ? sale.ownerShare
                            : sale.partnerShare,
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-[14rem] text-[var(--muted)]">
                        {sale.note?.trim() ? (
                          <span className="whitespace-pre-wrap break-words">
                            {sale.note.trim()}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {sale.settlement ? (
                          <Badge tone="neutral">Закрыт</Badge>
                        ) : (
                          <Badge tone="success">Текущий</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
