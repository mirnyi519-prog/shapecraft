import { prisma } from "@/lib/db";
import { activeHoldWhere } from "@/lib/product-holds";

/** Оплаченный заказ держит штуки, пока его не отменят и не передадут в СДЭК. */
export const RESERVING_ORDER_STATUS = "paid";

type HoldClient = Pick<typeof prisma, "productHold">;
type ReserveClient = Pick<typeof prisma, "deliveryOrderLine">;

export function freeUnits(stock: number, held: number, reserved: number): number {
  return Math.max(0, stock - held - reserved);
}

export async function reservedQuantityByProduct(
  productIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(productIds)];
  const map = new Map<string, number>();
  if (unique.length === 0) {
    return map;
  }

  const rows = await prisma.deliveryOrderLine.groupBy({
    by: ["productId"],
    where: {
      productId: { in: unique },
      order: { status: RESERVING_ORDER_STATUS },
    },
    _sum: { quantity: true },
  });

  for (const row of rows) {
    map.set(row.productId, row._sum.quantity ?? 0);
  }
  return map;
}

export async function heldUnitsInTx(
  tx: HoldClient,
  productId: string,
  now = new Date(),
): Promise<number> {
  const held = await tx.productHold.aggregate({
    where: { productId, ...activeHoldWhere(now) },
    _sum: { quantity: true },
  });
  return held._sum.quantity ?? 0;
}

export async function reservedUnitsInTx(
  tx: ReserveClient,
  productId: string,
): Promise<number> {
  const reserved = await tx.deliveryOrderLine.aggregate({
    where: { productId, order: { status: RESERVING_ORDER_STATUS } },
    _sum: { quantity: true },
  });
  return reserved._sum.quantity ?? 0;
}
