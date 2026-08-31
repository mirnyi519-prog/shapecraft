import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isIpBlocked } from "@/lib/access-control";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request);

    if (await isIpBlocked(ip)) {
      void logSecurityEvent({
        type: "ip_block",
        ipAddress: ip,
        path: "/api/auth/login",
        detail: "Попытка входа с заблокированного IP",
      });
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const attemptLimit = rateLimit({
      key: `login-attempt:${ip}`,
      limit: LOGIN_MAX_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MS,
    });

    if (!attemptLimit.ok) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_LOCK,
        ipAddress: ip,
        path: "/api/auth/login",
        detail: "Превышен лимит попыток входа",
      });
      return tooManyRequests(
        attemptLimit.retryAfterSec,
        "Слишком много попыток входа. Подождите 15 минут.",
      );
    }

    const body = (await request.json()) as {
      login?: string;
      password?: string;
    };

    const login = body.login?.trim().toLowerCase();
    const password = body.password;

    if (!login || !password) {
      return NextResponse.json(
        { error: "Укажите логин и пароль" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user || !(await verifyPassword(password, user.password))) {
      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_FAIL,
        ipAddress: ip,
        path: "/api/auth/login",
        detail: `Логин: ${login}`,
      });

      if (attemptLimit.remaining === 0) {
        void logSecurityEvent({
          type: SECURITY_EVENT_TYPES.LOGIN_LOCK,
          ipAddress: ip,
          path: "/api/auth/login",
          detail: `Исчерпан лимит попыток для ${login}`,
        });
      }

      return NextResponse.json(
        { error: "Неверный логин или пароль" },
        { status: 401 },
      );
    }

    await createSession({
      id: user.id,
      login: user.login,
      name: user.name,
      role: user.role === "partner" ? "partner" : "admin",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка входа" }, { status: 500 });
  }
}
