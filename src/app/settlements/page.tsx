import { AppShell } from "@/components/app-shell";
import { PartnerExportButton } from "@/components/partner-export-button";
import { SettlementPanel } from "@/components/settlement-panel";
import { Card, StatCard } from "@/components/ui";
import { formatDate, formatDateTime, formatRub } from "@/lib/calculations";
import { getSession } from "@/lib/auth";
import {
  otherShareLabel,
  selfShareLabel,
  settlementShareLines,
} from "@/lib/labels";
import { prisma } from "@/lib/db";

export default async function SettlementsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const pendingSales = await prisma.sale.findMany({
    where: { settlementId: null },
    orderBy: { soldAt: "asc" },
  });

  const totals = pendingSales.reduce(
    (acc, sale) => ({
      totalRevenue: acc.totalRevenue + sale.amount,
      totalCost: acc.totalCost + sale.costTotal,
      totalProfit: acc.totalProfit + sale.profit,
      ownerShare: acc.ownerShare + sale.ownerShare,
      partnerShare: acc.partnerShare + sale.partnerShare,
    }),
    {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      ownerShare: 0,
      partnerShare: 0,
    },
  );

  const zeroStockCount = await prisma.product.count({
    where: { active: true, stock: 0 },
  });

  const settlements = await prisma.settlement.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sales: true } } },
  });

  const lastSettlement = settlements[0] ?? null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Расчёты</h1>
            <p className="text-[var(--muted)]">
              Текущий период
              {lastSettlement ? ` после ${formatDate(lastSettlement.createdAt)}` : ""}
            </p>
          </div>
          {pendingSales.length > 0 ? (
            <PartnerExportButton
              scope="current"
              label="Скачать период (CSV)"
            />
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Выручка периода" value={formatRub(totals.totalRevenue)} />
          {session.role === "admin" ? (
            <StatCard label="Себестоимость" value={formatRub(totals.totalCost)} />
          ) : null}
          <StatCard
            label={selfShareLabel(session.role)}
            value={formatRub(
              session.role === "admin" ? totals.ownerShare : totals.partnerShare,
            )}
            accent
          />
          <StatCard
            label={otherShareLabel(session.role)}
            value={formatRub(
              session.role === "admin" ? totals.partnerShare : totals.ownerShare,
            )}
            accent
          />
        </div>

        {session.role === "admin" ? (
          <Card title="Зафиксировать расчёт">
            <p className="mb-4 text-sm text-[var(--muted)]">
              После проведения расчёта текущий период обнуляется, продажи уходят в архив.
              Перед этим передайте деньги партнёру.
            </p>
            <SettlementPanel
              pendingSalesCount={pendingSales.length}
              zeroStockCount={zeroStockCount}
              partnerShare={totals.partnerShare}
              totalRevenue={totals.totalRevenue}
            />
          </Card>
        ) : null}

        <Card title="История расчётов">
          {settlements.length === 0 ? (
            <p className="text-[var(--muted)]">Расчётов пока не было.</p>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="rounded-xl bg-[var(--bg)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {formatDateTime(settlement.createdAt)}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {settlement._count.sales} продаж · прибыль{" "}
                        {formatRub(settlement.totalProfit)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right text-sm">
                      {(() => {
                        const lines = settlementShareLines(
                          formatRub(settlement.ownerShare),
                          formatRub(settlement.partnerShare),
                        );
                        return (
                          <>
                            <p>{lines.supplier}</p>
                            <p>{lines.partner}</p>
                          </>
                        );
                      })()}
                      <PartnerExportButton
                        scope="settlement"
                        settlementId={settlement.id}
                        label="CSV для партнёра"
                      />
                    </div>
                  </div>
                  {settlement.note ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">{settlement.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
