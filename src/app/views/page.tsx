import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { Button, Card, StatCard } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { getBuyClickStats } from "@/lib/buy-clicks";
import { formatDateTime } from "@/lib/calculations";
import { prisma } from "@/lib/db";

type ViewsTab = "cards" | "buy";

function parseTab(value: string | undefined): ViewsTab {
  return value === "buy" ? "buy" : "cards";
}

export default async function ViewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const tab = parseTab((await searchParams).tab);

  const [productViews, buyStats] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ viewCount: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        imageUrl: true,
        viewCount: true,
        buyClickCount: true,
        active: true,
      },
    }),
    getBuyClickStats(),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Просмотры</h1>
            <p className="text-[var(--muted)]">
              Открытия карточек и клики «Купить» на витрине
            </p>
          </div>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="min-h-11 w-full sm:w-auto">
              К сводке
            </Button>
          </Link>
        </div>

        <div
          className="inline-flex rounded-full border border-[var(--border)] bg-white p-1"
          role="tablist"
          aria-label="Раздел просмотров"
        >
          <Link
            href="/views"
            role="tab"
            aria-selected={tab === "cards"}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === "cards"
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--text)] hover:bg-[var(--bg)]"
            }`}
          >
            Карточки
          </Link>
          <Link
            href="/views?tab=buy"
            role="tab"
            aria-selected={tab === "buy"}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === "buy"
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--text)] hover:bg-[var(--bg)]"
            }`}
          >
            Клики «Купить»
          </Link>
        </div>

        {tab === "cards" ? (
          <Card title="Просмотры карточек на витрине">
            {productViews.every((item) => item.viewCount === 0) ? (
              <p className="text-[var(--muted)]">
                Пока нет данных — просмотры считаются при открытии карточки.
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
                      {productViews.map((product) => (
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
                            aria-label={`${product.name}`}
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Всего кликов" value={String(buyStats.totalClicks)} />
              <StatCard
                label="Сегодня"
                value={String(buyStats.clicksToday)}
                accent
              />
              <StatCard label="За 7 дней" value={String(buyStats.clicksWeek)} />
              <StatCard label="Уникальных IP" value={String(buyStats.uniqueIps)} />
              <StatCard
                label="Уник. посетителей"
                value={String(buyStats.uniqueVisitors)}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="Топ товаров по «Купить»">
                {buyStats.topProducts.length === 0 ? (
                  <p className="text-[var(--muted)]">Кликов пока нет.</p>
                ) : (
                  <div className="space-y-3">
                    {buyStats.topProducts.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg)] px-3 py-3 hover:bg-[var(--brand-soft)]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <ProductThumb
                            src={product.imageUrl}
                            alt={product.name}
                            size={44}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{product.name}</p>
                            <p className="text-xs text-[var(--muted)]">
                              просмотров {product.viewCount}
                              {!product.active ? " · архив" : ""}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-lg font-bold text-[var(--brand)]">
                          {product.buyClickCount}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Кто нажимал чаще">
                {buyStats.byIp.length === 0 ? (
                  <p className="text-[var(--muted)]">Данных пока нет.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">IP</th>
                          <th className="pb-2 pr-3 font-medium text-right">Клики</th>
                          <th className="pb-2 font-medium text-right">Последний</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buyStats.byIp.map((row) => (
                          <tr
                            key={row.ipAddress}
                            className="border-t border-[var(--border)]"
                          >
                            <td className="py-2 pr-3 font-mono text-xs">
                              {row.ipAddress}
                            </td>
                            <td className="py-2 pr-3 text-right font-semibold">
                              {row.clickCount}
                            </td>
                            <td className="py-2 text-right text-[var(--muted)]">
                              {row.lastClickAt
                                ? formatDateTime(row.lastClickAt)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <Card title="Последние клики «Купить»">
              {buyStats.recent.length === 0 ? (
                <p className="text-[var(--muted)]">Кликов пока нет.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-3 font-medium">Когда</th>
                        <th className="px-3 py-3 font-medium">Товар</th>
                        <th className="px-3 py-3 font-medium">IP</th>
                        <th className="px-3 py-3 font-medium">Устройство</th>
                        <th className="px-3 py-3 font-medium">visitor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyStats.recent.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                            {formatDateTime(row.clickedAt)}
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              href={`/products/${row.productId}`}
                              className="font-medium hover:text-[var(--brand)]"
                            >
                              {row.productName}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">
                            {row.ipAddress}
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">
                            {row.device}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-[var(--muted)]">
                            {row.visitorId
                              ? `${row.visitorId.slice(0, 8)}…`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
