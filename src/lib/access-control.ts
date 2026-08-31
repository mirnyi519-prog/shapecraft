import { prisma } from "@/lib/db";
import {
  isIpBlockedStatic,
  parseBlockedIpsFromEnv,
  DEFAULT_BLOCKED_IPS,
} from "@/lib/ip-blocklist";

export async function isIpBlocked(ip: string | null | undefined): Promise<boolean> {
  if (!ip || ip === "unknown") {
    return false;
  }

  if (isIpBlockedStatic(ip)) {
    return true;
  }

  const row = await prisma.blockedIp.findUnique({
    where: { ipAddress: ip.trim() },
  });
  return Boolean(row);
}

export async function listBlockedIps(): Promise<
  { id: string; ipAddress: string; reason: string | null; createdAt: Date; source: "db" | "static" }[]
> {
  const dbRows = await prisma.blockedIp.findMany({
    orderBy: { createdAt: "desc" },
  });

  const staticOnes = [
    ...DEFAULT_BLOCKED_IPS,
    ...parseBlockedIpsFromEnv(),
  ].filter((ip, index, arr) => arr.indexOf(ip) === index);

  const dbSet = new Set(dbRows.map((row) => row.ipAddress));
  const merged = [
    ...dbRows.map((row) => ({
      id: row.id,
      ipAddress: row.ipAddress,
      reason: row.reason,
      createdAt: row.createdAt,
      source: "db" as const,
    })),
    ...staticOnes
      .filter((ip) => !dbSet.has(ip))
      .map((ip) => ({
        id: `static:${ip}`,
        ipAddress: ip,
        reason: "Встроенный блоклист",
        createdAt: new Date(0),
        source: "static" as const,
      })),
  ];

  return merged;
}

export async function getSessionEpoch(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({
    where: { id: "default" },
  });
  const fromDb = setting?.sessionEpoch ?? 0;
  return Number.isFinite(fromDb) ? fromDb : 0;
}

export async function revokeAllSessions(): Promise<number> {
  // На секунду назад — чтобы новый JWT с iat=now точно прошёл проверку
  const epoch = Math.floor(Date.now() / 1000) - 1;
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ownerSplitPercent: 50,
      sessionEpoch: epoch,
    },
    update: { sessionEpoch: epoch },
  });
  return epoch;
}

export { isIpBlockedStatic };
