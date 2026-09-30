import { prisma } from "@/lib/db";

export const HOLD_MS = 2 * 60 * 60 * 1000;

export function activeHoldWhere(now = new Date()) {
  return {
    releasedAt: null as null,
    expiresAt: { gt: now },
  };
}

export function normalizeHoldPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `7${digits}`;
  }
  return null;
}

export function formatHoldPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) {
    return phone;
  }
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

export async function heldQuantityByProduct(
  productIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(productIds)];
  const map = new Map<string, number>();
  if (unique.length === 0) {
    return map;
  }

  const rows = await prisma.productHold.groupBy({
    by: ["productId"],
    where: {
      productId: { in: unique },
      ...activeHoldWhere(),
    },
    _sum: { quantity: true },
  });

  for (const row of rows) {
    map.set(row.productId, row._sum.quantity ?? 0);
  }
  return map;
}

type HoldTx = Pick<typeof prisma, "productHold">;

/** Снимает самые ранние активные брони, когда товар продали со стойки. */
export async function releaseHoldsForSale(
  tx: HoldTx,
  productId: string,
  quantity: number,
) {
  if (quantity < 1) {
    return;
  }

  const holds = await tx.productHold.findMany({
    where: { productId, ...activeHoldWhere() },
    orderBy: { createdAt: "asc" },
    select: { id: true, quantity: true },
  });

  let left = quantity;
  const now = new Date();
  for (const hold of holds) {
    if (left <= 0) {
      break;
    }
    await tx.productHold.update({
      where: { id: hold.id },
      data: { releasedAt: now, releaseReason: "sold" },
    });
    left -= hold.quantity;
  }
}
