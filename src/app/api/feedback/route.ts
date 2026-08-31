import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/visits";
import { rateLimit } from "@/lib/rate-limit";
import {
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";

type FeedbackBody = {
  name?: string;
  contact?: string;
  message?: string;
  productId?: string;
  /** Honeypot — должно быть пустым */
  website?: string;
};

function trimOptional(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const messages = await prisma.feedbackMessage.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    const unreadCount = messages.filter((item) => !item.read).length;

    return NextResponse.json({ messages, unreadCount });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `feedback:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!limited.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/feedback",
        detail: "Лимит обратной связи",
      });
      return tooManyRequests(
        limited.retryAfterSec,
        "Слишком много сообщений. Подождите немного.",
      );
    }

    const body = (await request.json()) as FeedbackBody;

    // Honeypot: боты заполняют скрытое поле — молча «успех»
    if (trimOptional(body.website, 100)) {
      return NextResponse.json({ ok: true, id: "ok" });
    }

    const message = trimOptional(body.message, 2000);

    if (!message || message.length < 3) {
      return NextResponse.json(
        { error: "Напишите сообщение хотя бы из нескольких слов" },
        { status: 400 },
      );
    }

    let productId: string | null = null;
    if (typeof body.productId === "string" && body.productId.trim()) {
      const product = await prisma.product.findUnique({
        where: { id: body.productId.trim() },
        select: { id: true, active: true },
      });
      if (!product || !product.active) {
        return NextResponse.json({ error: "Товар не найден" }, { status: 400 });
      }
      productId = product.id;
    }

    const created = await prisma.feedbackMessage.create({
      data: {
        name: trimOptional(body.name, 100),
        contact: trimOptional(body.contact, 200),
        message,
        ipAddress: getClientIp(request),
        productId,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { readAll?: boolean };

    if (body.readAll) {
      await prisma.feedbackMessage.updateMany({
        where: { read: false },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}
