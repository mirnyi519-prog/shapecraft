import { prisma } from "@/lib/db";

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
}): Promise<void> {
  const ip = input.ipAddress.trim() || "unknown";
  const path = input.path.trim() || "/";

  if (isBotUserAgent(input.userAgent ?? null)) {
    return;
  }

  await prisma.siteVisit.create({
    data: {
      ipAddress: ip,
      path,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
    },
  });
}

export type IpVisitSummary = {
  ipAddress: string;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  topPaths: { path: string; count: number }[];
  recentVisits: { path: string; visitedAt: string; userAgent: string | null }[];
};

export async function getVisitStats(): Promise<{
  totalVisits: number;
  uniqueIps: number;
  visitsToday: number;
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
      }[];
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
      };
      byIpMap.set(visit.ipAddress, row);
    }

    row.visitCount += 1;
    if (visit.visitedAt < row.firstVisit) {
      row.firstVisit = visit.visitedAt;
    }
    if (visit.visitedAt > row.lastVisit) {
      row.lastVisit = visit.visitedAt;
    }
    row.pathCounts.set(visit.path, (row.pathCounts.get(visit.path) ?? 0) + 1);
    if (row.recentVisits.length < 10) {
      row.recentVisits.push({
        path: visit.path,
        visitedAt: visit.visitedAt,
        userAgent: visit.userAgent,
      });
    }
  }

  const byIp: IpVisitSummary[] = [...byIpMap.entries()]
    .map(([ipAddress, row]) => ({
      ipAddress,
      visitCount: row.visitCount,
      firstVisit: row.firstVisit.toISOString(),
      lastVisit: row.lastVisit.toISOString(),
      topPaths: [...row.pathCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, count]) => ({ path, count })),
      recentVisits: row.recentVisits.map((item) => ({
        path: item.path,
        visitedAt: item.visitedAt.toISOString(),
        userAgent: item.userAgent,
      })),
    }))
    .sort((a, b) => b.visitCount - a.visitCount);

  return {
    totalVisits: visits.length,
    uniqueIps: byIpMap.size,
    visitsToday: visits.filter((visit) => visit.visitedAt >= todayStart).length,
    byIp,
  };
}
