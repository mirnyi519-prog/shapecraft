import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";

type LogBody = {
  type?: string;
  path?: string;
  detail?: string;
  ipAddress?: string;
};

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-security-log-secret");
    if (!secret || secret !== process.env.AUTH_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = clientIpFromRequest(request);
    const limited = rateLimit({
      key: `security-log:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(limited.retryAfterSec);
    }

    const body = (await request.json()) as LogBody;
    const type = body.type?.trim() || SECURITY_EVENT_TYPES.PROBE;

    await logSecurityEvent({
      type,
      ipAddress: body.ipAddress?.trim() || ip,
      path: body.path ?? null,
      detail: body.detail ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка журнала" }, { status: 500 });
  }
}
