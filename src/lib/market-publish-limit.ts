import { prisma } from "@/lib/db";

export const MARKET_PUBLISH_COOLDOWN_MS = 60 * 60 * 1000;

export type MarketPublishGate =
  | { ok: true }
  | { ok: false; retryAfterSec: number; nextAt: Date };

/**
 * Не чаще одного объявления в час (хранится в AppSetting, переживает рестарт).
 */
export async function claimMarketPublishSlot(): Promise<MarketPublishGate> {
  const now = new Date();
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  const cutoff = new Date(now.getTime() - MARKET_PUBLISH_COOLDOWN_MS);
  const claimed = await prisma.appSetting.updateMany({
    where: {
      id: "default",
      OR: [{ lastMarketPublishAt: null }, { lastMarketPublishAt: { lte: cutoff } }],
    },
    data: { lastMarketPublishAt: now },
  });

  if (claimed.count === 1) {
    return { ok: true };
  }

  const settings = await prisma.appSetting.findUnique({
    where: { id: "default" },
    select: { lastMarketPublishAt: true },
  });
  const last = settings?.lastMarketPublishAt ?? now;
  const retryAfterSec = Math.max(
    1,
    Math.ceil((last.getTime() + MARKET_PUBLISH_COOLDOWN_MS - now.getTime()) / 1000),
  );
  return {
    ok: false,
    retryAfterSec,
    nextAt: new Date(last.getTime() + MARKET_PUBLISH_COOLDOWN_MS),
  };
}

/** Откат слота, если отправка в Telegram не удалась. */
export async function releaseMarketPublishSlot(): Promise<void> {
  await prisma.appSetting.update({
    where: { id: "default" },
    data: { lastMarketPublishAt: null },
  });
}
