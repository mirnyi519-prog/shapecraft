import { NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  claimMarketPublishSlot,
  releaseMarketPublishSlot,
} from "@/lib/market-publish-limit";
import { hasListPrice } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";
import { publishProductToMarketChat } from "@/lib/telegram";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function formatRetryAfter(sec: number): string {
  const mins = Math.ceil(sec / 60);
  if (mins >= 60) {
    return "около часа";
  }
  if (mins <= 1) {
    return "около минуты";
  }
  return `около ${mins} мин`;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const ip = clientIpFromRequest(request);
    const burst = rateLimit({
      key: `product-publish-market:${session.login}:${ip}`,
      limit: 5,
      windowMs: 60_000,
    });
    if (!burst.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/products/publish-market",
        detail: "Лимит публикаций в маркет-чат (burst)",
      });
      return tooManyRequests(burst.retryAfterSec);
    }

    const gate = await claimMarketPublishSlot();
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Не чаще 1 объявления в час. Следующее можно через ${formatRetryAfter(gate.retryAfterSec)}.`,
          retryAfterSec: gate.retryAfterSec,
          nextAt: gate.nextAt.toISOString(),
        },
        { status: 429 },
      );
    }

    const { id } = await context.params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        listPrice: true,
        stock: true,
        active: true,
      },
    });

    if (!product) {
      await releaseMarketPublishSlot();
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    if (!hasListPrice(product.listPrice)) {
      await releaseMarketPublishSlot();
      return NextResponse.json(
        {
          error:
            "Сначала задайте цену в прайсе — без цены объявление не публикуем",
        },
        { status: 400 },
      );
    }

    const result = await publishProductToMarketChat({
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      listPrice: product.listPrice,
      stock: product.stock,
    });

    if (!result.ok) {
      await releaseMarketPublishSlot();
      return NextResponse.json(
        {
          ok: false,
          configured: result.configured,
          error: result.error ?? "Не удалось отправить в Telegram",
        },
        { status: result.configured === false ? 503 : 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      productId: product.id,
      active: product.active,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("publish-market failed", error);
    return NextResponse.json({ error: "Ошибка публикации" }, { status: 500 });
  }
}
