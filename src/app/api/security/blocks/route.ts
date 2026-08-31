import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listBlockedIps, revokeAllSessions } from "@/lib/access-control";
import { logSecurityEvent } from "@/lib/security";

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export async function GET() {
  try {
    await requireAdmin();
    const blocked = await listBlockedIps();
    return NextResponse.json({ blocked });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      action?: string;
      ipAddress?: string;
      reason?: string;
    };

    if (body.action === "revoke_sessions") {
      const epoch = await revokeAllSessions();
      void logSecurityEvent({
        type: "session_revoke",
        ipAddress: "admin",
        path: "/api/security/blocks",
        detail: `Админ ${session.login} сбросил сессии, epoch=${epoch}`,
      });
      return NextResponse.json({ ok: true, sessionEpoch: epoch });
    }

    const ip = body.ipAddress?.trim();
    if (!ip || !IPV4_RE.test(ip)) {
      return NextResponse.json(
        { error: "Укажите корректный IPv4" },
        { status: 400 },
      );
    }

    const row = await prisma.blockedIp.upsert({
      where: { ipAddress: ip },
      update: {
        reason: body.reason?.trim() || null,
      },
      create: {
        ipAddress: ip,
        reason: body.reason?.trim() || null,
      },
    });

    void logSecurityEvent({
      type: "ip_block",
      ipAddress: ip,
      path: "/api/security/blocks",
      detail: `Добавил ${session.login}: ${body.reason?.trim() || "без причины"}`,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as { ipAddress?: string };
    const ip = body.ipAddress?.trim();
    if (!ip) {
      return NextResponse.json({ error: "Укажите IP" }, { status: 400 });
    }

    await prisma.blockedIp.deleteMany({ where: { ipAddress: ip } });

    void logSecurityEvent({
      type: "ip_unblock",
      ipAddress: ip,
      path: "/api/security/blocks",
      detail: `Снял блок ${session.login}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
