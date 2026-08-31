/**
 * Блоклист IP — доступен и в Edge middleware, и в Node API.
 * Источники: жёсткий список + BLOCKED_IPS из env (через запятую).
 */

/** Известные атакующие / типичные сканеры, которых уже видели */
export const DEFAULT_BLOCKED_IPS: string[] = [
  "34.16.206.147", // Google Cloud — попытки взлома shapecraft.ru
];

function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase();
}

export function parseBlockedIpsFromEnv(
  envValue: string | undefined = process.env.BLOCKED_IPS,
): string[] {
  if (!envValue?.trim()) {
    return [];
  }
  return envValue
    .split(/[,;\s]+/)
    .map(normalizeIp)
    .filter(Boolean);
}

export function getStaticBlockedIps(): Set<string> {
  return new Set([
    ...DEFAULT_BLOCKED_IPS.map(normalizeIp),
    ...parseBlockedIpsFromEnv(),
  ]);
}

export function isIpBlockedStatic(ip: string | null | undefined): boolean {
  if (!ip || ip === "unknown") {
    return false;
  }
  return getStaticBlockedIps().has(normalizeIp(ip));
}

/** Совпадение точного IP или префикса CIDR /24 вида 34.16.206. */
export function isIpBlockedByList(
  ip: string | null | undefined,
  list: Iterable<string>,
): boolean {
  if (!ip || ip === "unknown") {
    return false;
  }
  const normalized = normalizeIp(ip);
  for (const entry of list) {
    const item = normalizeIp(entry);
    if (!item) {
      continue;
    }
    if (item.endsWith(".")) {
      if (normalized.startsWith(item)) {
        return true;
      }
      continue;
    }
    if (item.includes("/")) {
      // Простой /24: a.b.c.0/24
      const [base, bits] = item.split("/");
      if (bits === "24") {
        const prefix = base.split(".").slice(0, 3).join(".") + ".";
        if (normalized.startsWith(prefix)) {
          return true;
        }
      }
      continue;
    }
    if (normalized === item) {
      return true;
    }
  }
  return false;
}
