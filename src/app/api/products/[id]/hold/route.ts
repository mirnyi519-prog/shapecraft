import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/calculations";
import {
  HOLD_MS,
  activeHoldWhere,
  formatHoldPhone,
  normalizeHoldPhone,
} from "@/lib/product-holds";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";
import { sendTelegramMessage } from "@/lib/telegram";
import { VISITOR_COOKIE } from "@/lib/visit-tracking";
import { isAutomatedCrawlerUserAgent } from "@/lib/visits";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit({
      key: `product-hold:${ip}`,
      limit: 8,
      windowMs: 60_000,
    });

    if (!limited.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/products/hold",
        detail: "Лимит брони",
      });
      return tooManyRequests(limited.retryAfterSec);
    }

    const userAgent = request.headers.get("user-agent");
    if (isAutomatedCrawlerUserAgent(userAgent)) {
      return NextResponse.json({ error: "Не удалось забронировать" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { phone?: string } | null;
    const phone = normalizeHoldPhone(body?.phone ?? "");
    if (!phone) {
      return NextResponse.json(
        { error: "Укажите телефон, чтобы мы держали товар" },
        { status: 400 },
      );
    }

    const { id } = await context.params;
    const cookieStore = await cookies();
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value?.trim() || null;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        select: { id: true, active: true, name: true, stock: true },
      });
      if (!product || !product.active) {
        return { error: "Товар не найден", status: 404 as const };
      }

      const existing = await tx.productHold.findFirst({
        where: { productId: id, phone, ...activeHoldWhere(now) },
      });
      if (existing) {
        return { hold: existing, product, already: true };
      }

      const held = await tx.productHold.aggregate({
        where: { productId: id, ...activeHoldWhere(now) },
        _sum: { quantity: true },
      });
      const free = product.stock - (held._sum.quantity ?? 0);
      if (free < 1) {
        return { error: "Свободных штук нет — всё в брони или разобрали", status: 409 as const };
      }

      const hold = await tx.productHold.create({
        data: {
          productId: id,
          phone,
          quantity: 1,
          visitorId,
          ipAddress: ip,
          expiresAt: new Date(now.getTime() + HOLD_MS),
        },
      });
      return { hold, product, already: false };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const until = formatDateTime(result.hold.expiresAt);
    if (!result.already) {
      const telegram = await sendTelegramMessage(
        [
          "📌 Бронь на 2 часа",
          `Товар: ${result.product.name}`,
          `Телефон: ${formatHoldPhone(phone)}`,
          `Держим до: ${until}`,
          `Склад: ${result.product.stock} шт`,
        ].join("\n"),
      );
      if (!telegram.ok) {
        console.error("hold telegram", telegram.error ?? "failed");
      }
    }

    return NextResponse.json({
      ok: true,
      already: result.already,
      expiresAt: result.hold.expiresAt.toISOString(),
      until,
    });
  } catch {
    return NextResponse.json({ error: "Не удалось забронировать" }, { status: 500 });
  }
}
