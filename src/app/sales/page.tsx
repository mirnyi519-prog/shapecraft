import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { Badge, Card } from "@/components/ui";
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

  const shareLabel = selfShareLabel(session.role);
  const isAdminRole = session.role === "admin";

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Продажи</h1>
          <p className="text-[var(--muted)]">
            Журнал продаж. Новую продажу оформляйте из карточки товара.
          </p>
        </div>

        {sales.length === 0 ? (
          <Card>
            <p className="text-[var(--muted)]">Продаж пока нет.</p>
          </Card>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {sales.map((sale) => (
                <Card key={sale.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <ProductThumb
                      src={sale.product.imageUrl}
                      alt={sale.product.name}
                      size={56}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug">
                            {sale.product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {formatDateTime(sale.soldAt)} · {sale.quantity} шт
                          </p>
                        </div>
                        {sale.settlement ? (
                          <Badge tone="neutral">Закрыт</Badge>
                        ) : (
                          <Badge tone="success">Текущий</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="text-sm">
                          <p className="font-bold text-[var(--brand)]">
                            {formatRub(sale.amount)}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {shareLabel}:{" "}
                            {formatRub(
                              isAdminRole ? sale.ownerShare : sale.partnerShare,
                            )}
                          </p>
                        </div>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--brand)]"
                        >
                          Изменить
                        </Link>
                      </div>
                      {sale.note?.trim() ? (
                        <p className="whitespace-pre-wrap break-words text-sm text-[var(--muted)]">
                          {sale.note.trim()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                      <th className="px-3 py-3">Дата</th>
                      <th className="px-3 py-3">Товар / комментарий</th>
                      <th className="px-3 py-3">Кол-во</th>
                      <th className="px-3 py-3">Сумма</th>
                      {isAdminRole ? (
                        <th className="px-3 py-3">Себест.</th>
                      ) : null}
                      <th className="px-3 py-3">{shareLabel}</th>
                      <th className="px-3 py-3">Период</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-b border-[var(--border)] align-top"
                      >
                        <td className="whitespace-nowrap px-3 py-3">
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
                        <td className="px-3 py-3 font-medium">
                          {formatRub(sale.amount)}
                        </td>
                        {isAdminRole ? (
                          <td className="px-3 py-3">
                            {formatRub(sale.costTotal)}
                          </td>
                        ) : null}
                        <td className="px-3 py-3">
                          {formatRub(
                            isAdminRole ? sale.ownerShare : sale.partnerShare,
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {sale.settlement ? (
                            <Badge tone="neutral">Закрыт</Badge>
                          ) : (
                            <Badge tone="success">Текущий</Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
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
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
