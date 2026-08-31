import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/upload";
import {
  clientIpFromRequest,
  logSecurityEvent,
  MAX_UPLOAD_BYTES,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const ip = clientIpFromRequest(request);

    const limited = rateLimit({
      key: `upload:${ip}`,
      limit: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!limited.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/upload",
        detail: "Лимит загрузок",
      });
      return tooManyRequests(limited.retryAfterSec);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.UPLOAD_REJECT,
        ipAddress: ip,
        path: "/api/upload",
        detail: `Тип: ${file.type || "unknown"}`,
      });
      return NextResponse.json(
        { error: "Можно загружать только JPEG, PNG, WebP или GIF" },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.UPLOAD_REJECT,
        ipAddress: ip,
        path: "/api/upload",
        detail: `Размер: ${file.size}`,
      });
      return NextResponse.json(
        { error: "Файл слишком большой (макс. 5 МБ)" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const url = await saveUploadedImage(buffer, file.name || "paste.png", file.type);

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("upload error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? `Ошибка загрузки: ${error.message}` : "Ошибка загрузки",
      },
      { status: 500 },
    );
  }
}
