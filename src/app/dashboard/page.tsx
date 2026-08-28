import { AppShell } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { Badge, Card, StatCard } from "@/components/ui";
import { formatDate, formatDateTime, formatRub } from "@/lib/calculations";
import { getSession } from "@/lib/auth";
import { otherShareLabel, saleShareHint, selfShareLabel } from "@/lib/labels";
import { prisma } from "@/lib/db";

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

  return {
    role,
    totals,
    recentSales: pendingSales.slice(0, 8),
    lowStock,
    periodFrom: lastSettlement?.createdAt ?? null,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const data = await getDashboardData(session.role);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Сводка</h1>
          <p className="text-[var(--muted)]">
            Текущий период
            {data.periodFrom ? ` с ${formatDate(data.periodFrom)}` : " — с начала учёта"}
          </p>
        </div>

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
      </div>
    </AppShell>
  );
}
