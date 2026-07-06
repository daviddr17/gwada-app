/** Einfaches In-Memory-Rate-Limit pro Key-ID (VPS single-instance). */

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRestaurantApiRateLimit(
  keyId: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(keyId);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(keyId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export const RESTAURANT_API_RATE_LIMIT_PER_MINUTE = DEFAULT_LIMIT;
