import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  SESSION_COOKIE,
  signSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { verifyCaptchaChallenge } from "@/lib/captcha";
import { prisma } from "@/lib/db";
import { blockIpAddress, isIpBlocked } from "@/lib/access-control";
import {
  LOGIN_FAIL_LOCK_THRESHOLD,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-guard";
import { rateLimit } from "@/lib/rate-limit";
import {
  clientIpFromRequest,
  logSecurityEvent,
  SECURITY_EVENT_TYPES,
  tooManyRequests,
} from "@/lib/security";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request);
    const blocked = await isIpBlocked(ip);
    return NextResponse.json({
      ok: true,
      loginBlocked: blocked,
      captchaRequired: true,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка проверки" }, { status: 500 });
  }
}

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
      return NextResponse.json(
        {
          error: "Доступ запрещён. Слишком много неудачных попыток входа.",
          loginBlocked: true,
        },
        { status: 403 },
      );
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
      captchaId?: string;
      captchaAnswer?: string;
    };

    const login = body.login?.trim().toLowerCase();
    const password = body.password;

    if (!verifyCaptchaChallenge(body.captchaId ?? "", body.captchaAnswer)) {
      return NextResponse.json(
        {
          error: "Неверный ответ на проверку",
          captchaRequired: true,
        },
        { status: 400 },
      );
    }

    if (!login || !password) {
      return NextResponse.json(
        { error: "Укажите логин и пароль" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user || !(await verifyPassword(password, user.password))) {
      const failCount = recordLoginFailure(ip);

      void logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_FAIL,
        ipAddress: ip,
        path: "/api/auth/login",
        detail: `Логин: ${login}; попытка ${failCount}/${LOGIN_FAIL_LOCK_THRESHOLD}`,
      });

      if (failCount >= LOGIN_FAIL_LOCK_THRESHOLD) {
        await blockIpAddress(
          ip,
          `Автоблок: ${LOGIN_FAIL_LOCK_THRESHOLD} неудачных входа`,
        );
        void logSecurityEvent({
          type: SECURITY_EVENT_TYPES.LOGIN_LOCK,
          ipAddress: ip,
          path: "/api/auth/login",
          detail: `IP заблокирован после ${LOGIN_FAIL_LOCK_THRESHOLD} ошибок (${login})`,
        });

        return NextResponse.json(
          {
            error:
              "Доступ запрещён. Слишком много неудачных попыток входа.",
            loginBlocked: true,
            captchaRequired: true,
          },
          { status: 403 },
        );
      }

      if (attemptLimit.remaining === 0) {
        void logSecurityEvent({
          type: SECURITY_EVENT_TYPES.LOGIN_LOCK,
          ipAddress: ip,
          path: "/api/auth/login",
          detail: `Исчерпан лимит попыток для ${login}`,
        });
      }

      return NextResponse.json(
        {
          error: "Неверный логин или пароль",
          captchaRequired: true,
          attemptsLeft: LOGIN_FAIL_LOCK_THRESHOLD - failCount,
        },
        { status: 401 },
      );
    }

    clearLoginFailures(ip);

    const sessionUser = {
      id: user.id,
      login: user.login,
      name: user.name,
      role: user.role === "partner" ? ("partner" as const) : ("admin" as const),
    };
    const token = await signSessionToken(sessionUser);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Ошибка входа" }, { status: 500 });
  }
}
