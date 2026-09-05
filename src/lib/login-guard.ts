type FailureBucket = {
  count: number;
  resetAt: number;
};

const failures = new Map<string, FailureBucket>();
const FAILURE_WINDOW_MS = 30 * 60 * 1000;
export const LOGIN_FAIL_LOCK_THRESHOLD = 3;

function pruneExpired(now: number): void {
  if (failures.size < 500) {
    return;
  }
  for (const [key, bucket] of failures) {
    if (bucket.resetAt <= now) {
      failures.delete(key);
    }
  }
}

export function recordLoginFailure(ip: string): number {
  const now = Date.now();
  pruneExpired(now);

  const existing = failures.get(ip);
  if (!existing || existing.resetAt <= now) {
    failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return 1;
  }

  existing.count += 1;
  return existing.count;
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}

export function getLoginFailureCount(ip: string): number {
  const now = Date.now();
  const existing = failures.get(ip);
  if (!existing || existing.resetAt <= now) {
    failures.delete(ip);
    return 0;
  }
  return existing.count;
}

export function isLoginLocked(ip: string): boolean {
  return getLoginFailureCount(ip) >= LOGIN_FAIL_LOCK_THRESHOLD;
}
