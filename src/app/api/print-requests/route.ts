import { NextRequest, NextResponse } from "next/server";
import { formatDateTime, formatRub } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import { hasListPrice } from "@/lib/pricing";
import { formatHoldPhone, heldQuantityByProduct } from "@/lib/product-holds";
import {
  parsePrintCustomerName,
  parsePrintPhone,
  parsePrintQuantity,
  parsePrintSourceUrl,
} from "@/lib/print-request";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";
import { sendTelegramMessage } from "@/lib/telegram";
import { isIpBlocked } from "@/lib/access-control";

type PrintBody = {
  source?: string;
  title?: string;
  priceNote?: string | null;
  productId?: string;
  sourceUrl?: string | null;
  customerName?: string;
  phone?: string;
  quantity?: number | string;
  website?: string;
};

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request);
    if (await isIpBlocked(ip)) {
      return NextResponse.json({ error: "Доступ ограничен" }, { status: 403 });
    }

    const limited = rateLimit({
      key: `print-request:${ip}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!limited.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/print-requests",
        detail: "Лимит заявок на печать",
      });
      return tooManyRequests(limited.retryAfterSec);
    }

    const body = (await request.json()) as PrintBody;
    if (typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ ok: true });
    }

    const source = body.source === "world" ? "world" : body.source === "catalog" ? "catalog" : null;
    const customerName = parsePrintCustomerName(body.customerName);
    const phone = parsePrintPhone(body.phone);
    const quantity = parsePrintQuantity(body.quantity);

    if (!source || !customerName || !phone || !quantity) {
      return NextResponse.json(
        { error: "Укажите имя, телефон и количество от 1 до 20" },
        { status: 400 },
      );
    }

    let title = "";
    let priceLabel: string | null = null;
    let sourceUrl: string | null = null;
    let productId: string | null = null;

    if (source === "catalog") {
      const productIdRaw = body.productId?.trim();
      if (!productIdRaw) {
        return NextResponse.json({ error: "Товар не указан" }, { status: 400 });
      }
      const product = await prisma.product.findFirst({
        where: { id: productIdRaw, active: true },
        select: { id: true, name: true, listPrice: true, stock: true },
      });
      if (!product) {
        return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
      }
      const held = await heldQuantityByProduct([product.id]);
      const free = Math.max(0, product.stock - (held.get(product.id) ?? 0));
      if (free > 0) {
        return NextResponse.json(
          { error: "Эта модель есть в наличии — её можно купить" },
          { status: 400 },
        );
      }
      productId = product.id;
      title = product.name;
      priceLabel = hasListPrice(product.listPrice)
        ? formatRub(product.listPrice as number)
        : null;
    } else {
      title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
      if (title.length < 2) {
        return NextResponse.json({ error: "Модель не указана" }, { status: 400 });
      }
      const note =
        typeof body.priceNote === "string" ? body.priceNote.trim().slice(0, 80) : "";
      priceLabel = note || null;
      sourceUrl = parsePrintSourceUrl(body.sourceUrl);
    }

    const created = await prisma.printRequest.create({
      data: {
        source,
        productId,
        title,
        priceLabel,
        sourceUrl,
        customerName,
        phone,
        quantity,
        ipAddress: ip,
      },
    });

    const when = formatDateTime(created.createdAt);
    const lines = [
      "🖨️ Заявка на печать",
      `Модель: ${title}`,
      source === "world" ? "Откуда: В мире" : "Откуда: витрина",
    ];
    if (source === "world" && sourceUrl) {
      lines.push(`Ссылка: ${sourceUrl}`);
    }
    lines.push(
      priceLabel ? `Цена: ${priceLabel}` : "Цена: уточнить",
      `Имя: ${customerName}`,
      `Телефон: ${formatHoldPhone(phone)}`,
      `Количество: ${quantity}`,
      `Когда: ${when}`,
    );
    const telegram = await sendTelegramMessage(lines.join("\n"));
    if (!telegram.ok) {
      console.error("print-request telegram", telegram.error ?? "failed");
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить заявку" }, { status: 500 });
  }
}
