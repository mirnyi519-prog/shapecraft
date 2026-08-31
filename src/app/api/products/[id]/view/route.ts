import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit({
      key: `product-view:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });

    if (!limited.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/products/view",
        detail: "Лимит просмотров карточек",
      });
      return tooManyRequests(limited.retryAfterSec);
    }

    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, active: true },
    });

    if (!product || !product.active) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });

    return NextResponse.json({ ok: true, viewCount: updated.viewCount });
  } catch {
    return NextResponse.json({ error: "Ошибка записи просмотра" }, { status: 500 });
  }
}
