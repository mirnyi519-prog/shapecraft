import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/visits";

export const SECURITY_EVENT_TYPES = {
  LOGIN_FAIL: "login_fail",
  LOGIN_LOCK: "login_lock",
  RATE_LIMIT: "rate_limit",
  PROBE: "probe",
  UPLOAD_REJECT: "upload_reject",
} as const;

export type SecurityEventType =
  (typeof SECURITY_EVENT_TYPES)[keyof typeof SECURITY_EVENT_TYPES];

export function clientIpFromRequest(request: NextRequest | Request): string {
  return getClientIp(request);
}

export async function logSecurityEvent(input: {
  type: SecurityEventType | string;
  ipAddress: string;
  path?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        type: input.type,
        ipAddress: input.ipAddress || "unknown",
        path: input.path?.slice(0, 300) ?? null,
        detail: input.detail?.slice(0, 500) ?? null,
      },
    });
  } catch {
    // Не ломаем основной поток из‑за журнала
  }
}

export function tooManyRequests(
  retryAfterSec: number,
  message = "Слишком много запросов. Попробуйте позже.",
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}

/** Максимальный размер загружаемого изображения */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export {
  isProbePath,
  withSecurityHeaders,
} from "@/lib/security-edge";
