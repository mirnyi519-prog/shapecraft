import { prisma } from "@/lib/db";
import {
  activeHoursWeek,
  formatClock,
  type PickupWeekday,
  type StoreHoursConfig,
} from "@/lib/pickup-hours";
import { addMoscowDays, formatMoscow, moscowWeekday } from "@/lib/timezone";

export const HOLD_MS = 2 * 60 * 60 * 1000;
export const HOLD_MAX_QUANTITY = 10;
/** Меньше этого до закрытия — бронь переносится на следующий рабочий день. */
const HOLD_MIN_LEFT_MS = 60 * 60 * 1000;

export type HoldPlan = {
  expiresAt: Date;
  /** true — забрать можно сегодня в ближайшие часы. */
  sameDay: boolean;
  /** Строка для покупателя: когда забирать. */
  pickupText: string;
};

function dayLabel(date: Date, now: Date): string {
  const today = addMoscowDays(now, 0).getTime();
  const day = addMoscowDays(date, 0).getTime();
  const diff = Math.round((day - today) / (24 * 60 * 60 * 1000));
  if (diff === 0) {
    return "сегодня";
  }
  if (diff === 1) {
    return "завтра";
  }
  const weekday = WEEKDAY_ACCUSATIVE[moscowWeekday(date) as PickupWeekday];
  return `${weekday}, ${formatMoscow(date, { day: "numeric", month: "long" })}`;
}

const WEEKDAY_ACCUSATIVE: Record<PickupWeekday, string> = {
  0: "в воскресенье",
  1: "в понедельник",
  2: "во вторник",
  3: "в среду",
  4: "в четверг",
  5: "в пятницу",
  6: "в субботу",
};

/** Срок брони по графику пекарни: 2 часа, но не позже закрытия; если закрыто — до конца следующего рабочего дня. */
export function planHold(config: StoreHoursConfig, now: Date = new Date()): HoldPlan {
  for (let offset = 0; offset <= 14; offset++) {
    const dayStart = addMoscowDays(now, offset);
    const weekday = moscowWeekday(dayStart) as PickupWeekday;
    const hours = activeHoursWeek(config, dayStart)[weekday];
    if (hours.closed) {
      continue;
    }
    const openAt = new Date(dayStart.getTime() + hours.openMinute * 60_000);
    const closeAt = new Date(dayStart.getTime() + hours.closeMinute * 60_000);
    const range = `с ${formatClock(hours.openMinute)} до ${formatClock(hours.closeMinute)}`;

    if (offset === 0 && now >= openAt) {
      if (closeAt.getTime() - now.getTime() < HOLD_MIN_LEFT_MS) {
        continue;
      }
      const expiresAt = new Date(Math.min(now.getTime() + HOLD_MS, closeAt.getTime()));
      return {
        expiresAt,
        sameDay: true,
        pickupText: `Заберите сегодня до ${formatMoscow(expiresAt, { hour: "2-digit", minute: "2-digit" })}`,
      };
    }

    return {
      expiresAt: closeAt,
      sameDay: false,
      pickupText: `Заберите ${dayLabel(dayStart, now)} ${range}`,
    };
  }

  return {
    expiresAt: new Date(now.getTime() + HOLD_MS),
    sameDay: true,
    pickupText: "Заберите в ближайшие 2 часа",
  };
}

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
    if (hold.quantity > left) {
      await tx.productHold.update({
        where: { id: hold.id },
        data: { quantity: hold.quantity - left },
      });
      break;
    }
    await tx.productHold.update({
      where: { id: hold.id },
      data: { releasedAt: now, releaseReason: "sold" },
    });
    left -= hold.quantity;
  }
}
