import { checkInMemoryRateLimit } from "@/lib/api/in-memory-rate-limit";

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

export function checkRestaurantApiRateLimit(
  keyId: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  return checkInMemoryRateLimit(`restaurant-api-key:${keyId}`, limit, windowMs);
}

export const RESTAURANT_API_RATE_LIMIT_PER_MINUTE = DEFAULT_LIMIT;
