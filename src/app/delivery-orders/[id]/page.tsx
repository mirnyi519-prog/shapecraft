import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  DeliveryOrderEditor,
  type DeliveryOrderCardData,
} from "@/components/delivery-order-editor";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DELIVERY_MODES,
  DELIVERY_ORDER_STATUSES,
  type DeliveryMode,
  type DeliveryOrderStatus,
} from "@/lib/delivery-order";

function asStatus(value: string): DeliveryOrderStatus {
  return (DELIVERY_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as DeliveryOrderStatus)
    : "awaiting_payment";
}

function asMode(value: string): DeliveryMode {
  return (DELIVERY_MODES as readonly string[]).includes(value) ? (value as DeliveryMode) : "pvz";
}

export default async function DeliveryOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  if (!session) {
    redirect(`/login?next=/delivery-orders/${id}`);
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { name: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) {
    notFound();
  }

  const card: DeliveryOrderCardData = {
    id: order.id,
    number: order.number,
    status: asStatus(order.status),
    deliveryMode: asMode(order.deliveryMode),
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    recipientEmail: order.recipientEmail ?? "",
    city: order.city,
    address: order.address ?? "",
    pvzCode: order.pvzCode ?? "",
    pvzAddress: order.pvzAddress ?? "",
    comment: order.comment ?? "",
    cdekNumber: order.cdekNumber ?? "",
    goodsAmount: order.goodsAmount,
    deliveryAmount: order.deliveryAmount,
    lines: order.lines.map((line) => ({
      id: line.id,
      name: line.name,
      quantity: line.quantity,
      price: line.price,
    })),
    events: order.events.map((event) => ({
      id: event.id,
      status: event.status,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <DeliveryOrderEditor order={card} />
      </div>
    </AppShell>
  );
}
