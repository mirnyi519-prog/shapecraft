type FailureBucket = {
  count: number;
  resetAt: number;
};

const failures = new Map<string, FailureBucket>();
const FAILURE_WINDOW_MS = 30 * 60 * 1000;

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

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  pruneExpired(now);

  const existing = failures.get(ip);
  if (!existing || existing.resetAt <= now) {
    failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return;
  }

  existing.count += 1;
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}

export function isCaptchaRequired(ip: string): boolean {
  const now = Date.now();
  const existing = failures.get(ip);
  if (!existing || existing.resetAt <= now) {
    failures.delete(ip);
    return false;
  }

  return existing.count >= 1;
}
