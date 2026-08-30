import { NextRequest, NextResponse } from "next/server";
import { getClientIp, recordSiteVisit } from "@/lib/visits";

export const runtime = "nodejs";

type TrackBody = {
  path?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrackBody;
    const path = body.path?.trim() || "/";

    if (path.startsWith("/api") || path.startsWith("/_next")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await recordSiteVisit({
      ipAddress: getClientIp(request),
      path,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка записи" }, { status: 500 });
  }
}
