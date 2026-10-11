import { prisma } from "@/lib/db";
import { freeUnits, heldUnitsInTx, reservedUnitsInTx } from "@/lib/free-stock";
import { normalizeHoldPhone } from "@/lib/product-holds";

export const DELIVERY_MODES = ["pvz", "door"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_ORDER_STATUSES = [
  "awaiting_payment",
  "paid",
  "handed_to_cdek",
  "cancelled",
] as const;
export type DeliveryOrderStatus = (typeof DELIVERY_ORDER_STATUSES)[number];

export function deliveryModeLabel(mode: string): string {
  if (mode === "pvz") return "ПВЗ СДЭК";
  if (mode === "door") return "Курьер СДЭК";
  return mode;
}

export class DeliveryOrderError extends Error {}

export function deliveryOrderStatusLabel(status: string): string {
  switch (status) {
    case "awaiting_payment":
      return "Ждёт оплату";
    case "paid":
      return "Оплачен, держим остаток";
    case "handed_to_cdek":
      return "Передан в СДЭК";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

export async function payDeliveryOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) {
      throw new DeliveryOrderError("Заказ не найден");
    }
    if (order.status !== "awaiting_payment") {
      throw new DeliveryOrderError("Оплатить можно только заказ, который ещё ждёт оплату");
    }

    const need = new Map<string, number>();
    for (const line of order.lines) {
      need.set(line.productId, (need.get(line.productId) ?? 0) + line.quantity);
    }
    for (const [productId, quantity] of need) {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stock: true },
      });
      const free = freeUnits(
        product?.stock ?? 0,
        await heldUnitsInTx(tx, productId),
        await reservedUnitsInTx(tx, productId),
      );
      if (free < quantity) {
        throw new DeliveryOrderError("Недостаточно свободного остатка");
      }
    }

    const now = new Date();
    await tx.deliveryOrder.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paymentStatus: "paid",
        paidAt: now,
        codAmount: 0,
      },
    });
    await tx.deliveryOrderEvent.create({
      data: {
        orderId: order.id,
        status: "paid",
        note: "Оплата прошла, свободный остаток зарезервирован",
      },
    });
  });
}

export async function cancelDeliveryOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new DeliveryOrderError("Заказ не найден");
    }
    if (order.status === "cancelled") {
      return;
    }
    if (order.status === "handed_to_cdek") {
      throw new DeliveryOrderError("Заказ уже передан в СДЭК, отмена не возвращает остаток");
    }

    await tx.deliveryOrder.update({
      where: { id: order.id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    await tx.deliveryOrderEvent.create({
      data: {
        orderId: order.id,
        status: "cancelled",
        note:
          order.status === "paid"
            ? "Отмена: свободный остаток вернулся"
            : "Отмена до оплаты",
      },
    });
  });
}

export async function handDeliveryOrderToCdek(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) {
      throw new DeliveryOrderError("Заказ не найден");
    }
    if (order.status !== "paid") {
      throw new DeliveryOrderError("В СДЭК передаём только оплаченный заказ");
    }

    for (const line of order.lines) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        select: { stock: true },
      });
      if ((product?.stock ?? 0) < line.quantity) {
        throw new DeliveryOrderError("На складе меньше, чем в заказе");
      }
      await tx.product.update({
        where: { id: line.productId },
        data: { stock: { decrement: line.quantity } },
      });
    }

    await tx.deliveryOrder.update({
      where: { id: order.id },
      data: { status: "handed_to_cdek", handedToCdekAt: new Date() },
    });
    await tx.deliveryOrderEvent.create({
      data: {
        orderId: order.id,
        status: "handed_to_cdek",
        note: "Передан в СДЭК, складской остаток списан",
      },
    });
  });
}

export function parseDeliveryPhone(raw: string): string | null {
  return normalizeHoldPhone(raw);
}

export type DeliveryOrderFieldInput = {
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string | null;
  deliveryMode: DeliveryMode;
  city: string;
  address: string | null;
  pvzCode: string | null;
  pvzAddress: string | null;
  comment: string | null;
  cdekNumber: string | null;
  /**
   * Сумма доставки для покупателя. Правило: тариф СДЭК + 10% к этому тарифу.
   * Пока нет калькулятора СДЭК, значение вводится в карточке заказа.
   */
  deliveryAmount: number;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export async function updateDeliveryOrderFields(
  orderId: string,
  input: DeliveryOrderFieldInput,
): Promise<void> {
  const phone = parseDeliveryPhone(input.recipientPhone);
  if (!phone) {
    throw new DeliveryOrderError("Укажите телефон получателя");
  }
  const recipientName = input.recipientName.trim();
  const city = input.city.trim();
  if (recipientName.length < 2) {
    throw new DeliveryOrderError("Укажите имя получателя");
  }
  if (city.length < 2) {
    throw new DeliveryOrderError("Укажите город");
  }
  if (!DELIVERY_MODES.includes(input.deliveryMode)) {
    throw new DeliveryOrderError("Выберите пункт выдачи или курьера");
  }
  const address = clean(input.address);
  const pvzCode = clean(input.pvzCode);
  const pvzAddress = clean(input.pvzAddress);
  if (input.deliveryMode === "door" && !address) {
    throw new DeliveryOrderError("Для курьера нужен адрес");
  }
  if (input.deliveryMode === "pvz" && !pvzCode && !pvzAddress) {
    throw new DeliveryOrderError("Для пункта выдачи нужен код или адрес ПВЗ");
  }
  if (!Number.isFinite(input.deliveryAmount) || input.deliveryAmount < 0) {
    throw new DeliveryOrderError("Некорректная стоимость доставки");
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new DeliveryOrderError("Заказ не найден");
    }

    const customer = await tx.shopCustomer.upsert({
      where: { phone },
      update: { name: recipientName },
      create: { phone, name: recipientName },
    });

    await tx.deliveryOrder.update({
      where: { id: orderId },
      data: {
        customerId: customer.id,
        recipientName,
        recipientPhone: phone,
        recipientEmail: clean(input.recipientEmail),
        deliveryMode: input.deliveryMode,
        city,
        address,
        pvzCode,
        pvzAddress,
        comment: clean(input.comment),
        cdekNumber: clean(input.cdekNumber),
        deliveryAmount: input.deliveryAmount,
      },
    });
  });
}
