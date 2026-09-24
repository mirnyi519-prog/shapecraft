export const VISITOR_COOKIE = "shapecraft_visitor";

/** Окно «один визит = одна сессия» (не плодим строки на каждый F5). */
export const VISIT_SESSION_MS = 30 * 60 * 1000;

export type TrackVisitPayload = {
  path?: string;
  referer?: string | null;
  visitorId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export function getVisitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.COOKIE_SECURE === "true",
  };
}

export function normalizeUtmValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim().slice(0, 120);
  return trimmed ? trimmed : null;
}

/**
 * Какие URL считаем «визитом витрины».
 * Админка, экран, логин, API — не считаем (иначе сами себе крутим статистику).
 */
export function isTrackableVisitPath(pathname: string): boolean {
  if (!pathname || pathname.length > 300) {
    return false;
  }
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads")
  ) {
    return false;
  }

  // Витрина для гостей
  if (pathname === "/") {
    return true;
  }

  // Явно не витрина
  const skipExact = new Set(["/login", "/display"]);
  if (skipExact.has(pathname)) {
    return false;
  }

  const skipPrefixes = [
    "/dashboard",
    "/products",
    "/sales",
    "/settlements",
    "/receipts",
    "/packaging",
    "/users",
    "/visits",
    "/views",
    "/feedback",
    "/world",
    "/security",
    "/categories",
    "/banner",
    "/settings",
    "/display",
    "/login",
  ];
  if (skipPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  // Прочие публичные страницы пока не заводим в статистику
  return false;
}
