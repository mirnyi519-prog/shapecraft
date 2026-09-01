export const VISITOR_COOKIE = "shapecraft_visitor";

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
