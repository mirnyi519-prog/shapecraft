import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isProbePath, withSecurityHeaders } from "@/lib/security-edge";
import { isIpBlockedStatic } from "@/lib/ip-blocklist";

const SESSION_COOKIE = "shapecraft_session";
const publicPaths = ["/login"];

const skipTrackingPrefixes = ["/api", "/_next", "/favicon", "/uploads"];

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function trackPageVisit(request: NextRequest, pathname: string): void {
  if (skipTrackingPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return;
  }

  const trackUrl = new URL("/api/visits/track", request.url);
  void fetch(trackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for":
        request.headers.get("x-forwarded-for") ?? getClientIp(request),
      "x-real-ip": request.headers.get("x-real-ip") ?? "",
      "user-agent": request.headers.get("user-agent") ?? "",
    },
    body: JSON.stringify({ path: pathname }),
  }).catch(() => {});
}

function logSecurityHit(
  request: NextRequest,
  type: string,
  pathname: string,
  detail?: string,
): void {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return;
  }

  const logUrl = new URL("/api/security/log", request.url);
  void fetch(logUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-security-log-secret": secret,
      "x-forwarded-for":
        request.headers.get("x-forwarded-for") ?? getClientIp(request),
      "x-real-ip": request.headers.get("x-real-ip") ?? "",
      "user-agent": request.headers.get("user-agent") ?? "",
    },
    body: JSON.stringify({
      type,
      path: pathname,
      ipAddress: getClientIp(request),
      detail:
        detail ?? request.headers.get("user-agent")?.slice(0, 200) ?? null,
    }),
  }).catch(() => {});
}

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return false;
  }

  try {
    await jwtVerify(token, getAuthSecret());
    return true;
  } catch {
    return false;
  }
}

function blockedResponse(): NextResponse {
  return withSecurityHeaders(
    new NextResponse("Access denied", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  if (isIpBlockedStatic(ip)) {
    logSecurityHit(request, "ip_block", pathname, "IP в блоклисте");
    return blockedResponse();
  }

  if (isProbePath(pathname)) {
    logSecurityHit(request, "probe", pathname);
    return withSecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  // API дальше обрабатывают сами (с DB-блоклистом), здесь только статический блок
  if (pathname.startsWith("/api")) {
    return withSecurityHeaders(NextResponse.next());
  }

  const isPublic =
    pathname === "/" ||
    pathname === "/display" ||
    publicPaths.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/favicon");

  let response: NextResponse;

  if (isPublic) {
    if (pathname.startsWith("/login") && (await hasValidSession(request))) {
      response = NextResponse.redirect(new URL("/dashboard", request.url));
      return withSecurityHeaders(response);
    }
    trackPageVisit(request, pathname);
    response = NextResponse.next();
    return withSecurityHeaders(response);
  }

  if (!(await hasValidSession(request))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    response = NextResponse.redirect(loginUrl);
    // Сбрасываем протухшую cookie
    response.cookies.delete(SESSION_COOKIE);
    return withSecurityHeaders(response);
  }

  trackPageVisit(request, pathname);
  response = NextResponse.next();
  return withSecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
