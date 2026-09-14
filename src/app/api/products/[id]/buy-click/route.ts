import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";
import { sendTelegramMessage } from "@/lib/telegram";
import { VISITOR_COOKIE } from "@/lib/visit-tracking";
import { isBotUserAgent } from "@/lib/visits";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit({
      key: `product-buy-click:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });

    if (!limited.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/products/buy-click",
        detail: "Лимит кликов «Купить»",
      });
      return tooManyRequests(limited.retryAfterSec);
    }

    const userAgent = request.headers.get("user-agent");
    if (isBotUserAgent(userAgent)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, active: true, name: true, stock: true },
    });

    if (!product || !product.active) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const cookieStore = await cookies();
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value?.trim() || null;

    const [, updated] = await prisma.$transaction([
      prisma.productBuyClick.create({
        data: {
          productId: id,
          ipAddress: ip,
          userAgent: userAgent?.slice(0, 512) ?? null,
          visitorId,
        },
      }),
      prisma.product.update({
        where: { id },
        data: { buyClickCount: { increment: 1 } },
        select: { buyClickCount: true },
      }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [clicksTodayTotal, clicksTodayProduct] = await Promise.all([
      prisma.productBuyClick.count({ where: { clickedAt: { gte: today } } }),
      prisma.productBuyClick.count({
        where: { productId: id, clickedAt: { gte: today } },
      }),
    ]);

    const when = new Date().toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    void sendTelegramMessage(
      [
        "🛒 Купить на витрине",
        `Товар: ${product.name}`,
        `Остаток: ${product.stock} шт`,
        `Когда: ${when}`,
        `По этому товару сегодня: ${clicksTodayProduct}`,
        `Всего «Купить» сегодня: ${clicksTodayTotal}`,
        `IP: ${ip}`,
      ].join("\n"),
    ).then((result) => {
      if (!result.ok) {
        console.error("buy-click telegram", result.error ?? "failed");
      }
    });

    return NextResponse.json({ ok: true, buyClickCount: updated.buyClickCount });
  } catch {
    return NextResponse.json({ error: "Ошибка записи клика" }, { status: 500 });
  }
}
