import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/upload";
import {
  clientIpFromRequest,
  logSecurityEvent,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import {
  convertVideoBufferToGif,
  isVideoUpload,
  VIDEO_TO_GIF_MAX_SECONDS,
} from "@/lib/video-to-gif";

export const runtime = "nodejs";
export const maxDuration = 90;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function isAllowedImage(file: File): boolean {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    return true;
  }
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name || "");
}

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

    const asVideo = isVideoUpload(file);
    const asImage = isAllowedImage(file);

    if (!asVideo && !asImage) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.UPLOAD_REJECT,
        ipAddress: ip,
        path: "/api/upload",
        detail: `Тип: ${file.type || "unknown"}`,
      });
      return NextResponse.json(
        {
          error:
            "Можно загружать JPEG, PNG, WebP, GIF или видео MP4/WebM/MOV (само станет GIF)",
        },
        { status: 400 },
      );
    }

    const maxBytes = asVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
    if (file.size > maxBytes) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.UPLOAD_REJECT,
        ipAddress: ip,
        path: "/api/upload",
        detail: `Размер: ${file.size}`,
      });
      return NextResponse.json(
        {
          error: asVideo
            ? "Видео слишком большое (макс. 40 МБ)"
            : "Файл слишком большой (макс. 8 МБ)",
        },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (asVideo) {
      try {
        const gifBuffer = await convertVideoBufferToGif(
          buffer,
          file.name || "video.mp4",
        );
        if (gifBuffer.length > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            {
              error: `GIF после конвертации слишком большой (${Math.ceil(gifBuffer.length / (1024 * 1024))} МБ). Сократите ролик или загрузите уже готовый GIF.`,
            },
            { status: 400 },
          );
        }
        const url = await saveUploadedImage(
          gifBuffer,
          `from-video-${Date.now()}.gif`,
          "image/gif",
        );
        return NextResponse.json({
          url,
          convertedFromVideo: true,
          maxSeconds: VIDEO_TO_GIF_MAX_SECONDS,
        });
      } catch (error) {
        console.error("video to gif failed", error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Не удалось перекодировать видео в GIF",
          },
          { status: 500 },
        );
      }
    }

    const url = await saveUploadedImage(
      buffer,
      file.name || "paste.png",
      file.type,
    );

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("upload error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Ошибка загрузки: ${error.message}`
            : "Ошибка загрузки",
      },
      { status: 500 },
    );
  }
}
