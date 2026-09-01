import { prisma } from "@/lib/db";
import { normalizeUtmValue } from "@/lib/visit-tracking";

export function getClientIp(request: Request): string {
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

const BOT_PATTERN =
  /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|telegram/i;

export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) {
    return false;
  }
  return BOT_PATTERN.test(userAgent);
}

export async function recordSiteVisit(input: {
  ipAddress: string;
  path: string;
  userAgent?: string | null;
  referer?: string | null;
  visitorId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): Promise<void> {
  const ip = input.ipAddress.trim() || "unknown";
  const path = input.path.trim() || "/";
  const visitorId = input.visitorId?.trim() || null;

  if (isBotUserAgent(input.userAgent ?? null)) {
    return;
  }

  const priorVisits = visitorId
    ? await prisma.siteVisit.count({ where: { visitorId } })
    : 0;

  await prisma.siteVisit.create({
    data: {
      ipAddress: ip,
      path,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      referrer: input.referer?.trim().slice(0, 500) ?? null,
      utmSource: normalizeUtmValue(input.utmSource),
      utmMedium: normalizeUtmValue(input.utmMedium),
      utmCampaign: normalizeUtmValue(input.utmCampaign),
      visitorId,
      isReturning: priorVisits > 0,
    },
  });
}

export type ReferrerInfo = {
  raw: string | null;
  label: string;
};

export function parseReferrer(referer: string | null | undefined): ReferrerInfo {
  if (!referer?.trim()) {
    return { raw: null, label: "Прямой заход" };
  }

  try {
    const url = new URL(referer);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (host.includes("shapecraft.ru") || host === "localhost" || host === "127.0.0.1") {
      return { raw: referer, label: "Сайт" };
    }
    if (host.includes("t.me") || host.includes("telegram")) {
      return { raw: referer, label: "Telegram" };
    }
    if (host.includes("yandex")) {
      return { raw: referer, label: "Яндекс" };
    }
    if (host.includes("google")) {
      return { raw: referer, label: "Google" };
    }
    if (host.includes("vk.com") || host === "vk.ru") {
      return { raw: referer, label: "VK" };
    }
    if (host.includes("instagram")) {
      return { raw: referer, label: "Instagram" };
    }
    if (host.includes("facebook") || host === "fb.com") {
      return { raw: referer, label: "Facebook" };
    }

    return { raw: referer, label: host };
  } catch {
    return { raw: referer, label: "Другое" };
  }
}

export function formatUtm(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): string | null {
  const parts = [input.utmSource, input.utmMedium, input.utmCampaign].filter(
    Boolean,
  ) as string[];
  return parts.length > 0 ? parts.join(" / ") : null;
}

export type ParsedUserAgent = {
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  deviceLabel: string;
  browser: string;
  os: string;
  summary: string;
};

export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent?.trim()) {
    return {
      deviceType: "unknown",
      deviceLabel: "Неизвестно",
      browser: "—",
      os: "—",
      summary: "Неизвестно",
    };
  }

  const ua = userAgent;
  const lower = ua.toLowerCase();

  let deviceType: ParsedUserAgent["deviceType"] = "desktop";
  let deviceLabel = "Компьютер";

  if (/ipad|tablet|kindle|playbook|silk(?!k)/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    deviceType = "tablet";
    deviceLabel = "Планшет";
  } else if (
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(
      ua,
    )
  ) {
    deviceType = "mobile";
    deviceLabel = "Телефон";
  }

  let os = "Другое";
  if (/windows nt/i.test(ua)) {
    os = "Windows";
  } else if (/mac os x/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)) {
    os = "macOS";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/android/i.test(ua)) {
    os = "Android";
  } else if (/cros/i.test(ua)) {
    os = "ChromeOS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  let browser = "Браузер";
  if (/edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
    browser = "Opera";
  } else if (/yabrowser/i.test(ua)) {
    browser = "Яндекс";
  } else if (/samsungbrowser/i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
    browser = "Safari";
  }

  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) {
    deviceLabel = "Бот";
    deviceType = "unknown";
  }

  return {
    deviceType,
    deviceLabel,
    browser,
    os,
    summary: `${deviceLabel} · ${os} · ${browser}`,
  };
}

export type IpVisitSummary = {
  ipAddress: string;
  visitCount: number;
  newVisits: number;
  returningVisits: number;
  firstVisit: string;
  lastVisit: string;
  device: ParsedUserAgent;
  referrer: ReferrerInfo;
  utm: string | null;
  lastIsReturning: boolean;
  topPaths: { path: string; count: number }[];
  recentVisits: {
    path: string;
    visitedAt: string;
    userAgent: string | null;
    device: ParsedUserAgent;
    referrer: ReferrerInfo;
    utm: string | null;
    isReturning: boolean;
  }[];
};

export async function getVisitStats(): Promise<{
  totalVisits: number;
  uniqueIps: number;
  visitsToday: number;
  newVisitsToday: number;
  returningVisitsToday: number;
  byIp: IpVisitSummary[];
}> {
  const visits = await prisma.siteVisit.findMany({
    orderBy: { visitedAt: "desc" },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const byIpMap = new Map<
    string,
    {
      visitCount: number;
      firstVisit: Date;
      lastVisit: Date;
      pathCounts: Map<string, number>;
      recentVisits: {
        path: string;
        visitedAt: Date;
        userAgent: string | null;
        referrer: string | null;
        utmSource: string | null;
        utmMedium: string | null;
        utmCampaign: string | null;
        isReturning: boolean;
      }[];
      lastUserAgent: string | null;
      lastReferrer: string | null;
      lastUtmSource: string | null;
      lastUtmMedium: string | null;
      lastUtmCampaign: string | null;
      lastIsReturning: boolean;
      newVisits: number;
      returningVisits: number;
    }
  >();

  for (const visit of visits) {
    let row = byIpMap.get(visit.ipAddress);
    if (!row) {
      row = {
        visitCount: 0,
        firstVisit: visit.visitedAt,
        lastVisit: visit.visitedAt,
        pathCounts: new Map(),
        recentVisits: [],
        lastUserAgent: null,
        lastReferrer: null,
        lastUtmSource: null,
        lastUtmMedium: null,
        lastUtmCampaign: null,
        lastIsReturning: false,
        newVisits: 0,
        returningVisits: 0,
      };
      byIpMap.set(visit.ipAddress, row);
    }

    row.visitCount += 1;
    if (visit.isReturning) {
      row.returningVisits += 1;
    } else {
      row.newVisits += 1;
    }
    if (visit.visitedAt < row.firstVisit) {
      row.firstVisit = visit.visitedAt;
    }
    if (visit.visitedAt > row.lastVisit) {
      row.lastVisit = visit.visitedAt;
      row.lastUserAgent = visit.userAgent;
      row.lastReferrer = visit.referrer;
      row.lastUtmSource = visit.utmSource;
      row.lastUtmMedium = visit.utmMedium;
      row.lastUtmCampaign = visit.utmCampaign;
      row.lastIsReturning = visit.isReturning;
    }
    row.pathCounts.set(visit.path, (row.pathCounts.get(visit.path) ?? 0) + 1);
    if (row.recentVisits.length < 10) {
      row.recentVisits.push({
        path: visit.path,
        visitedAt: visit.visitedAt,
        userAgent: visit.userAgent,
        referrer: visit.referrer,
        utmSource: visit.utmSource,
        utmMedium: visit.utmMedium,
        utmCampaign: visit.utmCampaign,
        isReturning: visit.isReturning,
      });
    }
  }

  const byIp: IpVisitSummary[] = [...byIpMap.entries()]
    .map(([ipAddress, row]) => ({
      ipAddress,
      visitCount: row.visitCount,
      newVisits: row.newVisits,
      returningVisits: row.returningVisits,
      firstVisit: row.firstVisit.toISOString(),
      lastVisit: row.lastVisit.toISOString(),
      device: parseUserAgent(row.lastUserAgent),
      referrer: parseReferrer(row.lastReferrer),
      utm: formatUtm({
        utmSource: row.lastUtmSource,
        utmMedium: row.lastUtmMedium,
        utmCampaign: row.lastUtmCampaign,
      }),
      lastIsReturning: row.lastIsReturning,
      topPaths: [...row.pathCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, count]) => ({ path, count })),
      recentVisits: row.recentVisits.map((item) => ({
        path: item.path,
        visitedAt: item.visitedAt.toISOString(),
        userAgent: item.userAgent,
        device: parseUserAgent(item.userAgent),
        referrer: parseReferrer(item.referrer),
        utm: formatUtm({
          utmSource: item.utmSource,
          utmMedium: item.utmMedium,
          utmCampaign: item.utmCampaign,
        }),
        isReturning: item.isReturning,
      })),
    }))
    .sort((a, b) => b.visitCount - a.visitCount);

  const todayVisits = visits.filter((visit) => visit.visitedAt >= todayStart);

  return {
    totalVisits: visits.length,
    uniqueIps: byIpMap.size,
    visitsToday: todayVisits.length,
    newVisitsToday: todayVisits.filter((visit) => !visit.isReturning).length,
    returningVisitsToday: todayVisits.filter((visit) => visit.isReturning).length,
    byIp,
  };
}
