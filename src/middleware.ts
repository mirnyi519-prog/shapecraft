import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isProbePath, withSecurityHeaders } from "@/lib/security-edge";

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

function logProbe(request: NextRequest, pathname: string): void {
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
      type: "probe",
      path: pathname,
      ipAddress: getClientIp(request),
      detail: request.headers.get("user-agent")?.slice(0, 200) ?? null,
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProbePath(pathname)) {
    logProbe(request, pathname);
    return withSecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  const isPublic =
    pathname === "/" ||
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
    return withSecurityHeaders(response);
  }

  trackPageVisit(request, pathname);
  response = NextResponse.next();
  return withSecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
