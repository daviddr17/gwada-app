import "server-only";

/** Fehlversuche pro gekoppeltem Display, danach Sperre. */
export const DISPLAY_PIN_MAX_FAILURES = 5;

/** Sperrzeit nach zu vielen Fehlversuchen. */
export const DISPLAY_PIN_LOCKOUT_MS = 15 * 60 * 1000;

type PinFailureBucket = {
  failures: number;
  lockedUntil: number;
};

const buckets = new Map<string, PinFailureBucket>();

function bucketKey(displayId: string): string {
  return displayId.trim();
}

export type DisplayPinRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

export function checkDisplayPinRateLimit(
  displayId: string,
): DisplayPinRateLimitResult {
  const bucket = buckets.get(bucketKey(displayId));
  if (!bucket) return { allowed: true };

  const now = Date.now();
  if (bucket.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((bucket.lockedUntil - now) / 1000),
      ),
    };
  }

  if (bucket.lockedUntil > 0 && bucket.lockedUntil <= now) {
    buckets.delete(bucketKey(displayId));
  }

  return { allowed: true };
}

export function recordDisplayPinFailure(displayId: string): void {
  const key = bucketKey(displayId);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { failures: 1, lockedUntil: 0 });
    return;
  }

  if (bucket.lockedUntil > now) return;

  bucket.failures += 1;
  if (bucket.failures >= DISPLAY_PIN_MAX_FAILURES) {
    bucket.lockedUntil = now + DISPLAY_PIN_LOCKOUT_MS;
  }
}

export function clearDisplayPinFailures(displayId: string): void {
  buckets.delete(bucketKey(displayId));
}
