import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  DELIVERY_MODES,
  DeliveryOrderError,
  cancelDeliveryOrder,
  handDeliveryOrderToCdek,
  payDeliveryOrder,
  updateDeliveryOrderFields,
  type DeliveryMode,
} from "@/lib/delivery-order";

export const runtime = "nodejs";

function isDeliveryMode(value: string): value is DeliveryMode {
  return (DELIVERY_MODES as readonly string[]).includes(value);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as {
      recipientName?: string;
      recipientPhone?: string;
      recipientEmail?: string | null;
      deliveryMode?: string;
      city?: string;
      address?: string | null;
      pvzCode?: string | null;
      pvzAddress?: string | null;
      comment?: string | null;
      cdekNumber?: string | null;
      deliveryAmount?: number;
      status?: string;
    };

    if (!body.deliveryMode || !isDeliveryMode(body.deliveryMode)) {
      return NextResponse.json({ error: "Выберите пункт выдачи или курьера" }, { status: 400 });
    }

    await updateDeliveryOrderFields(id, {
      recipientName: body.recipientName ?? "",
      recipientPhone: body.recipientPhone ?? "",
      recipientEmail: body.recipientEmail ?? null,
      deliveryMode: body.deliveryMode,
      city: body.city ?? "",
      address: body.address ?? null,
      pvzCode: body.pvzCode ?? null,
      pvzAddress: body.pvzAddress ?? null,
      comment: body.comment ?? null,
      cdekNumber: body.cdekNumber ?? null,
      deliveryAmount: Number(body.deliveryAmount ?? 0),
    });

    if (body.status === "paid") {
      await payDeliveryOrder(id);
    } else if (body.status === "cancelled") {
      await cancelDeliveryOrder(id);
    } else if (body.status === "handed_to_cdek") {
      await handDeliveryOrderToCdek(id);
    } else if (body.status) {
      return NextResponse.json({ error: "Такой статус поставить нельзя" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DeliveryOrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    console.error("delivery order patch", error);
    return NextResponse.json({ error: "Не удалось сохранить заказ" }, { status: 500 });
  }
}
