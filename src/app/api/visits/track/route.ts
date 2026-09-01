import { NextRequest, NextResponse } from "next/server";
import { getClientIp, recordSiteVisit } from "@/lib/visits";
import { isIpBlocked } from "@/lib/access-control";
import { rateLimit } from "@/lib/rate-limit";
import {
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";
import type { TrackVisitPayload } from "@/lib/visit-tracking";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (await isIpBlocked(ip)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const limited = rateLimit({
      key: `visit-track:${ip}`,
      limit: 120,
      windowMs: 60_000,
    });

    if (!limited.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMIT,
        ipAddress: ip,
        path: "/api/visits/track",
        detail: "Лимит записи визитов",
      });
      return tooManyRequests(limited.retryAfterSec);
    }

    const body = (await request.json()) as TrackVisitPayload;
    const path = body.path?.trim() || "/";

    if (
      path.startsWith("/api") ||
      path.startsWith("/_next") ||
      path.length > 300
    ) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await recordSiteVisit({
      ipAddress: ip,
      path,
      userAgent: request.headers.get("user-agent"),
      referer: body.referer ?? request.headers.get("referer"),
      visitorId: body.visitorId,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка записи" }, { status: 500 });
  }
}
