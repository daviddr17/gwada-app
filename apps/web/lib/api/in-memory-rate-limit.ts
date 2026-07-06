/** Einfaches In-Memory-Rate-Limit (VPS single-instance). */

export type RateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkInMemoryRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): RateLimitCheckResult {
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
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
