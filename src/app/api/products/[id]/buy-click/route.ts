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
      select: { id: true, active: true },
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

    return NextResponse.json({ ok: true, buyClickCount: updated.buyClickCount });
  } catch {
    return NextResponse.json({ error: "Ошибка записи клика" }, { status: 500 });
  }
}
