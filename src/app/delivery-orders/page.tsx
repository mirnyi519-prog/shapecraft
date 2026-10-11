import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NavIcon } from "@/components/nav-icon";
import { Badge, Card } from "@/components/ui";
import { formatDateTime, formatRub } from "@/lib/calculations";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  deliveryModeLabel,
  deliveryOrderStatusLabel,
} from "@/lib/delivery-order";
import { formatHoldPhone } from "@/lib/product-holds";

export default async function DeliveryOrdersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/delivery-orders");
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const orders = await prisma.deliveryOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lines: { select: { name: true, quantity: true } },
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Заказы СДЭК</h1>
          <p className="text-[var(--muted)]">
            Доставка СДЭК: пункт выдачи или курьер. На витрине оформление
            закрыто, пока заказы выключены в настройках.
          </p>
        </div>

        {orders.length === 0 ? (
          <Card title="Журнал">
            <p className="text-sm text-[var(--muted)]">Заказов с доставкой пока нет.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/delivery-orders/${order.id}`} className="min-w-0 flex-1 space-y-2 text-sm">
                    <h2 className="text-lg font-semibold">{order.number}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={order.status === "cancelled" ? "neutral" : "warning"}>
                        {deliveryOrderStatusLabel(order.status)}
                      </Badge>
                      <span>{deliveryModeLabel(order.deliveryMode)}</span>
                    </div>
                    <p>
                      {order.recipientName} · {formatHoldPhone(order.recipientPhone)}
                    </p>
                    <p className="text-[#3d3d3e]">
                      {order.deliveryMode === "door" && order.address
                        ? `${order.city}, ${order.address}`
                        : order.pvzAddress
                          ? `${order.city} · ${order.pvzAddress}`
                          : order.city}
                    </p>
                    <p className="text-[#3d3d3e]">
                      {order.lines.map((line) => `${line.name} × ${line.quantity}`).join(", ")}
                    </p>
                    <p>
                      {formatRub(order.goodsAmount + order.deliveryAmount)}
                      {order.deliveryAmount > 0
                        ? ` · доставка ${formatRub(order.deliveryAmount)}`
                        : ""}
                      {" · "}
                      {formatDateTime(order.createdAt)}
                    </p>
                    {order.cdekNumber ? <p>Трек: {order.cdekNumber}</p> : null}
                  </Link>
                  <Link
                    href={`/delivery-orders/${order.id}/label?print=1`}
                    aria-label={`Печать адресного ярлыка ${order.number}`}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                  >
                    <NavIcon name="print" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
