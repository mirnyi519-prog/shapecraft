import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/calculations";
import { freeUnits, heldUnitsInTx, reservedUnitsInTx } from "@/lib/free-stock";
import {
  HOLD_MAX_QUANTITY,
  activeHoldWhere,
  formatHoldPhone,
  normalizeHoldPhone,
  planHold,
} from "@/lib/product-holds";
import { rateLimit } from "@/lib/rate-limit";
import { getStoreHoursConfig } from "@/lib/store-settings";
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

/** Сколько можно забронировать и до какого времени — для окна «Купить». */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        select: { active: true, stock: true },
      });
      if (!product || !product.active) {
        return null;
      }
      const held = await heldUnitsInTx(tx, id, now);
      const reserved = await reservedUnitsInTx(tx, id);
      return freeUnits(product.stock, held, reserved);
    });
    if (result === null) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }
    const plan = planHold(await getStoreHoursConfig(), now);
    return NextResponse.json({
      free: Math.min(result, HOLD_MAX_QUANTITY),
      sameDay: plan.sameDay,
      pickupText: plan.pickupText,
    });
  } catch {
    return NextResponse.json({ error: "Не удалось проверить бронь" }, { status: 500 });
  }
}

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

    const body = (await request.json().catch(() => null)) as {
      phone?: string;
      quantity?: number;
    } | null;
    const phone = normalizeHoldPhone(body?.phone ?? "");
    const quantity = Math.floor(Number(body?.quantity ?? 1));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > HOLD_MAX_QUANTITY) {
      return NextResponse.json({ error: "Неверное количество" }, { status: 400 });
    }
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
    const plan = planHold(await getStoreHoursConfig(), now);

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

      const held = await heldUnitsInTx(tx, id, now);
      const reserved = await reservedUnitsInTx(tx, id);
      const free = freeUnits(product.stock, held, reserved);
      if (free < 1) {
        return { error: "Свободных штук нет — всё в брони или разобрали", status: 409 as const };
      }
      if (free < quantity) {
        return { error: `Свободно только ${free} шт`, status: 409 as const };
      }

      const hold = await tx.productHold.create({
        data: {
          productId: id,
          phone,
          quantity,
          visitorId,
          ipAddress: ip,
          expiresAt: plan.expiresAt,
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
          "📌 Бронь",
          `Товар: ${result.product.name} × ${result.hold.quantity} шт`,
          `Покупателю: ${plan.pickupText}`,
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
      quantity: result.hold.quantity,
    });
  } catch {
    return NextResponse.json({ error: "Не удалось забронировать" }, { status: 500 });
  }
}
