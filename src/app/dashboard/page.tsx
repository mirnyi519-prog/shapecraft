import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PriceListPrint } from "@/components/price-list-print";
import { ProductThumb } from "@/components/product-thumb";
import { SalesChart } from "@/components/sales-chart";
import { Badge, Button, Card, StatCard } from "@/components/ui";
import { formatDate, formatDateTime, formatRub } from "@/lib/calculations";
import { getSession, isAdmin } from "@/lib/auth";
import { getBuyClickStats } from "@/lib/buy-clicks";
import { otherShareLabel, saleShareHint, selfShareLabel } from "@/lib/labels";
import { prisma } from "@/lib/db";
import { getVisitStats } from "@/lib/visits";
import {
  getAllTimeSalesTotals,
  getSalesChartSeries,
  getTopSoldProducts,
} from "@/lib/sales-stats";

type DashboardTab = "period" | "stock" | "storefront" | "totals";

const DASHBOARD_TABS: {
  id: DashboardTab;
  label: string;
  adminOnly?: boolean;
}[] = [
  { id: "period", label: "Период" },
  { id: "stock", label: "Склад" },
  { id: "storefront", label: "Витрина", adminOnly: true },
  { id: "totals", label: "Итого" },
];

function parseDashboardTab(
  value: string | undefined,
  admin: boolean,
): DashboardTab {
  if (value === "stock" || value === "totals") {
    return value;
  }
  if (value === "storefront" && admin) {
    return "storefront";
  }
  return "period";
}

function tabHref(tab: DashboardTab): string {
  return tab === "period" ? "/dashboard" : `/dashboard?tab=${tab}`;
}

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
    take: 8,
  });

  const inventory =
    role === "admin"
      ? await prisma.product.findMany({
          where: { stock: { gt: 0 } },
          select: { stock: true, costPrice: true, active: true },
        })
      : [];

  const inventoryStock = inventory.reduce((sum, item) => sum + item.stock, 0);
  const inventoryCost = inventory.reduce(
    (sum, item) => sum + item.stock * item.costPrice,
    0,
  );
  const inventorySku = inventory.length;

  const productViews =
    role === "admin"
      ? await prisma.product.findMany({
          orderBy: [{ viewCount: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            imageUrl: true,
            viewCount: true,
            buyClickCount: true,
            active: true,
          },
          take: 12,
        })
      : [];

  return {
    role,
    totals,
    recentSales: pendingSales.slice(0, 8),
    lowStock,
    productViews,
    inventoryStock,
    inventoryCost,
    inventorySku,
    periodFrom: lastSettlement?.createdAt ?? null,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const admin = isAdmin(session.role);
  const tab = parseDashboardTab((await searchParams).tab, admin);

  const data = await getDashboardData(session.role);
  const visitStats = admin ? await getVisitStats() : null;
  const [allTimeTotals, topSoldProducts, salesChart, buyStats] =
    await Promise.all([
      getAllTimeSalesTotals(),
      getTopSoldProducts(10),
      getSalesChartSeries("month"),
      admin ? getBuyClickStats() : Promise.resolve(null),
    ]);

  const visibleTabs = DASHBOARD_TABS.filter((item) => !item.adminOnly || admin);

  return (
    <AppShell>
      <div className="space-y-6">
        <PriceListPrint>
          <h1 className="text-2xl font-bold">Сводка</h1>
          <p className="text-[var(--muted)]">Обзор продаж и остатков</p>
        </PriceListPrint>

        <div
          className="flex gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-white p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Разделы сводки"
        >
          {visibleTabs.map((item) => {
            const active = tab === item.id;
            return (
              <Link
                key={item.id}
                href={tabHref(item.id)}
                role="tab"
                aria-selected={active}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--text)] hover:bg-[var(--bg)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {tab === "period" ? (
          <section className="space-y-6">
            <SalesChart
              initialData={salesChart}
              role={session.role}
              selfShareLabel={selfShareLabel(session.role)}
              otherShareLabel={otherShareLabel(session.role)}
            />

            <div>
              <h2 className="text-lg font-semibold">Текущий период</h2>
              <p className="text-sm text-[var(--muted)]">
                {data.periodFrom
                  ? `С ${formatDate(data.periodFrom)}`
                  : "С начала учёта"}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Продано штук" value={String(data.totals.count)} />
              <StatCard
                label="Выручка"
                value={formatRub(data.totals.totalRevenue)}
              />
              {admin ? (
                <StatCard
                  label="Себестоимость проданного"
                  value={formatRub(data.totals.totalCost)}
                />
              ) : null}
              <StatCard
                label={selfShareLabel(session.role)}
                value={formatRub(
                  admin ? data.totals.ownerShare : data.totals.partnerShare,
                )}
                accent
              />
              <StatCard
                label={otherShareLabel(session.role)}
                value={formatRub(
                  admin ? data.totals.partnerShare : data.totals.ownerShare,
                )}
                accent
              />
            </div>

            <Card
              title="Последние продажи периода"
              action={
                <Link
                  href="/sales"
                  className="text-sm font-medium text-[var(--brand)]"
                >
                  Журнал →
                </Link>
              }
            >
              {data.recentSales.length === 0 ? (
                <p className="text-[var(--muted)]">
                  Пока нет продаж в текущем периоде.
                </p>
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
                              admin ? sale.ownerShare : sale.partnerShare,
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        ) : null}

        {tab === "stock" ? (
          <section className="space-y-6">
            {admin ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold">
                    Остаток по себестоимости
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    Сумма остатков на складе по себестоимости товаров
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    label="Остаток по себестоимости"
                    value={formatRub(data.inventoryCost)}
                    accent
                  />
                  <StatCard
                    label="Штук на складе"
                    value={String(data.inventoryStock)}
                  />
                  <StatCard
                    label="Позиций с остатком"
                    value={String(data.inventorySku)}
                  />
                </div>
              </>
            ) : null}

            <Card
              title="Низкий остаток"
              action={
                <Link
                  href="/products?view=out"
                  className="text-sm font-medium text-[var(--brand)]"
                >
                  Товары →
                </Link>
              }
            >
              {data.lowStock.length === 0 ? (
                <p className="text-[var(--muted)]">
                  Все товары в достаточном количестве.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.lowStock.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="flex items-center justify-between rounded-xl bg-[var(--bg)] px-4 py-3 hover:bg-[var(--brand-soft)]"
                    >
                      <span className="font-medium">{product.name}</span>
                      <Badge tone={product.stock === 0 ? "warning" : "neutral"}>
                        {product.stock} шт
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>
        ) : null}

        {tab === "storefront" && admin && visitStats ? (
          <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Витрина и интерес</h2>
                <p className="text-sm text-[var(--muted)]">
                  Визиты сайта, просмотры карточек и клики «Купить»
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/visits">
                  <Button variant="secondary" className="min-h-11">
                    Посещения
                  </Button>
                </Link>
                <Link href="/views">
                  <Button variant="secondary" className="min-h-11">
                    Просмотры
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Визитов на сайте"
                value={String(visitStats.totalVisits)}
              />
              <StatCard
                label="Уникальных IP"
                value={String(visitStats.uniqueIps)}
              />
              <StatCard
                label="Визитов сегодня"
                value={String(visitStats.visitsToday)}
                hint={`${visitStats.newVisitsToday} нов · ${visitStats.returningVisitsToday} повт`}
                accent
              />
              {buyStats ? (
                <StatCard
                  label="«Купить» сегодня"
                  value={String(buyStats.clicksToday)}
                  hint={`всего ${buyStats.totalClicks}`}
                />
              ) : null}
            </div>

            <Card
              title="Топ по просмотрам и «Купить»"
              action={
                <Link
                  href="/views?tab=buy"
                  className="text-sm font-medium text-[var(--brand)]"
                >
                  Клики →
                </Link>
              }
            >
              {data.productViews.length === 0 ? (
                <p className="text-[var(--muted)]">
                  Пока нет данных — просмотры считаются при открытии карточки на
                  витрине.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Фото</th>
                          <th className="px-4 py-3 font-medium">Название</th>
                          <th className="px-4 py-3 font-medium text-right">
                            Просмотры
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            «Купить»
                          </th>
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
                            <td className="px-4 py-3 text-right font-semibold">
                              {product.buyClickCount}
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
          </section>
        ) : null}

        {tab === "totals" ? (
          <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Всего продано</h2>
                <p className="text-sm text-[var(--muted)]">
                  За всё время · в журнале {allTimeTotals.saleCount}
                </p>
              </div>
              <Link href="/sales">
                <Button variant="secondary" className="min-h-11">
                  Журнал продаж
                </Button>
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
              {admin ? (
                <StatCard
                  label="Себестоимость"
                  value={formatRub(allTimeTotals.totalCost)}
                />
              ) : null}
              <StatCard
                label={selfShareLabel(session.role)}
                value={formatRub(
                  admin
                    ? allTimeTotals.ownerShare
                    : allTimeTotals.partnerShare,
                )}
              />
              <StatCard
                label={otherShareLabel(session.role)}
                value={formatRub(
                  admin
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
                                <span className="font-medium">
                                  {product.name}
                                </span>
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
        ) : null}
      </div>
    </AppShell>
  );
}
