import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { Badge, Button, Card, StatCard } from "@/components/ui";
import { formatDate, formatDateTime, formatRub } from "@/lib/calculations";
import { getSession, isAdmin } from "@/lib/auth";
import { otherShareLabel, saleShareHint, selfShareLabel } from "@/lib/labels";
import { prisma } from "@/lib/db";
import { getVisitStats } from "@/lib/visits";
import {
  getAllTimeSalesTotals,
  getTopSoldProducts,
} from "@/lib/sales-stats";

async function getDashboardData(role: "admin" | "partner") {
  const pendingSales = await prisma.sale.findMany({
    where: { settlementId: null },
    include: { product: { select: { name: true, imageUrl: true } } },
    orderBy: { soldAt: "desc" },
  });

  const totals = pendingSales.reduce(
    (acc, sale) => ({
      count: acc.count + sale.quantity,
      totalRevenue: acc.totalRevenue + sale.amount,
      totalCost: acc.totalCost + sale.costTotal,
      ownerShare: acc.ownerShare + sale.ownerShare,
      partnerShare: acc.partnerShare + sale.partnerShare,
    }),
    {
      count: 0,
      totalRevenue: 0,
      totalCost: 0,
      ownerShare: 0,
      partnerShare: 0,
    },
  );

  const lastSettlement = await prisma.settlement.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const lowStock = await prisma.product.findMany({
    where: { active: true, stock: { lte: 2 } },
    orderBy: { stock: "asc" },
    take: 5,
  });

  const productViews =
    role === "admin"
      ? await prisma.product.findMany({
          orderBy: [{ viewCount: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            imageUrl: true,
            viewCount: true,
            active: true,
          },
        })
      : [];

  return {
    role,
    totals,
    recentSales: pendingSales.slice(0, 8),
    lowStock,
    productViews,
    periodFrom: lastSettlement?.createdAt ?? null,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const data = await getDashboardData(session.role);
  const visitStats = isAdmin(session.role) ? await getVisitStats() : null;
  const allTimeTotals = await getAllTimeSalesTotals();
  const topSoldProducts = await getTopSoldProducts(10);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Сводка</h1>
          <p className="text-[var(--muted)]">
            Обзор продаж и остатков
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Всего продано</h2>
              <p className="text-sm text-[var(--muted)]">
                За всё время · в журнале {allTimeTotals.saleCount}
              </p>
            </div>
            <Link href="/sales">
              <Button variant="secondary">Журнал продаж</Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Продано штук"
              value={String(allTimeTotals.count)}
              accent
            />
            <StatCard
              label="Выручка"
              value={formatRub(allTimeTotals.totalRevenue)}
            />
            {session.role === "admin" ? (
              <StatCard
                label="Себестоимость"
                value={formatRub(allTimeTotals.totalCost)}
              />
            ) : null}
            <StatCard
              label={selfShareLabel(session.role)}
              value={formatRub(
                session.role === "admin"
                  ? allTimeTotals.ownerShare
                  : allTimeTotals.partnerShare,
              )}
            />
            <StatCard
              label={otherShareLabel(session.role)}
              value={formatRub(
                session.role === "admin"
                  ? allTimeTotals.partnerShare
                  : allTimeTotals.ownerShare,
              )}
            />
          </div>

          <Card title="Топ товаров по продажам">
            {topSoldProducts.length === 0 ? (
              <p className="text-[var(--muted)]">Продаж пока нет.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Товар</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Продано
                        </th>
                        <th className="px-4 py-3 font-medium text-right">
                          Выручка
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSoldProducts.map((product, index) => (
                        <tr
                          key={product.productId}
                          className="relative border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)]"
                        >
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ProductThumb
                                src={product.imageUrl}
                                alt={product.name}
                                size={44}
                              />
                              <span className="font-medium">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {product.quantity} шт
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatRub(product.revenue)}
                          </td>
                          <Link
                            href={`/products/${product.productId}`}
                            className="absolute inset-0"
                            aria-label={`${product.name}, ${product.quantity} шт`}
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Текущий период</h2>
            <p className="text-sm text-[var(--muted)]">
              {data.periodFrom ? `С ${formatDate(data.periodFrom)}` : "С начала учёта"}
            </p>
          </div>

        {visitStats ? (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Визитов на сайте" value={String(visitStats.totalVisits)} />
            <StatCard label="Уникальных IP" value={String(visitStats.uniqueIps)} />
            <StatCard
              label="Визитов сегодня"
              value={String(visitStats.visitsToday)}
              hint="Подробная таблица по IP"
              accent
            />
          </div>
        ) : null}

        {visitStats ? (
          <div className="flex justify-end">
            <Link href="/visits">
              <Button variant="secondary">Посещения по IP</Button>
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Продано штук" value={String(data.totals.count)} />
          <StatCard label="Выручка" value={formatRub(data.totals.totalRevenue)} />
          {session.role === "admin" ? (
            <StatCard
              label="Себестоимость проданного"
              value={formatRub(data.totals.totalCost)}
            />
          ) : null}
          <StatCard
            label={selfShareLabel(session.role)}
            value={formatRub(
              session.role === "admin"
                ? data.totals.ownerShare
                : data.totals.partnerShare,
            )}
            accent
          />
          <StatCard
            label={otherShareLabel(session.role)}
            value={formatRub(
              session.role === "admin"
                ? data.totals.partnerShare
                : data.totals.ownerShare,
            )}
            accent
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Последние продажи периода">
            {data.recentSales.length === 0 ? (
              <p className="text-[var(--muted)]">Пока нет продаж в текущем периоде.</p>
            ) : (
              <div className="space-y-3">
                {data.recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <ProductThumb
                        src={sale.product.imageUrl}
                        alt={sale.product.name}
                        size={44}
                      />
                      <div>
                        <p className="font-medium">{sale.product.name}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {formatDateTime(sale.soldAt)} · {sale.quantity} шт
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatRub(sale.amount)}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {saleShareHint(
                          session.role,
                          formatRub(
                            session.role === "admin"
                              ? sale.ownerShare
                              : sale.partnerShare,
                          ),
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Низкий остаток">
            {data.lowStock.length === 0 ? (
              <p className="text-[var(--muted)]">Все товары в достаточном количестве.</p>
            ) : (
              <div className="space-y-3">
                {data.lowStock.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--bg)] px-4 py-3"
                  >
                    <span>{product.name}</span>
                    <Badge tone={product.stock === 0 ? "warning" : "neutral"}>
                      {product.stock} шт
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {session.role === "admin" ? (
          <Card title="Просмотры товаров на витрине">
            {data.productViews.length === 0 ? (
              <p className="text-[var(--muted)]">
                Пока нет данных — просмотры считаются при открытии карточки на витрине.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 font-medium">Фото</th>
                        <th className="px-4 py-3 font-medium">Название</th>
                        <th className="px-4 py-3 font-medium text-right">Просмотры</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.productViews.map((product) => (
                        <tr
                          key={product.id}
                          className="relative border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)]"
                        >
                          <td className="px-4 py-3">
                            <ProductThumb
                              src={product.imageUrl}
                              alt={product.name}
                              size={48}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium">
                              {product.name}
                              {!product.active ? (
                                <span className="ml-2 text-xs text-[var(--muted)]">
                                  (архив)
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {product.viewCount}
                          </td>
                          <Link
                            href={`/products/${product.id}`}
                            className="absolute inset-0"
                            aria-label={`${product.name}, ${product.viewCount} просмотров`}
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        ) : null}
        </section>
      </div>
    </AppShell>
  );
}
