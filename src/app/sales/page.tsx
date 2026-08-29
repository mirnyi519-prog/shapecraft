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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Продажи</h1>
            <p className="text-[var(--muted)]">Журнал всех продаж</p>
          </div>
          <Link href="/sales/new" className="w-full sm:w-auto">
            <Button className="min-h-11 w-full sm:w-auto">+ Продажа</Button>
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
                    <th className="px-3 py-3">Товар / комментарий</th>
                    <th className="px-3 py-3">Кол-во</th>
                    <th className="px-3 py-3">Сумма</th>
                    {session.role === "admin" ? (
                      <th className="px-3 py-3">Себест.</th>
                    ) : null}
                    <th className="px-3 py-3">{selfShareLabel(session.role)}</th>
                    <th className="px-3 py-3">Период</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-[var(--border)] align-top">
                      <td className="px-3 py-3 whitespace-nowrap">
                        {formatDateTime(sale.soldAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-3">
                          <ProductThumb
                            src={sale.product.imageUrl}
                            alt={sale.product.name}
                            size={44}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{sale.product.name}</p>
                            {sale.note?.trim() ? (
                              <p className="mt-1 whitespace-pre-wrap break-words text-[var(--muted)]">
                                {sale.note.trim()}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                без комментария
                              </p>
                            )}
                          </div>
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
                      <td className="px-3 py-3">
                        {sale.settlement ? (
                          <Badge tone="neutral">Закрыт</Badge>
                        ) : (
                          <Badge tone="success">Текущий</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link
                          href={`/sales/${sale.id}`}
                          className="font-medium text-[var(--brand)] hover:underline"
                        >
                          Изменить
                        </Link>
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
