import "server-only";

/** Externe Plattform-Insights aktualisieren sich selten — einmal täglich reicht. */
export const PLATFORM_INSIGHTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Nach Google-Quota-Fehler bis zum nächsten Cache-Zyklus keine Live-Calls. */
export const PLATFORM_INSIGHTS_QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type PlatformInsightsCachePlatform = "google" | "facebook" | "instagram";

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const responseCache = new Map<string, CacheEntry>();
const googleQuotaUntilByRestaurant = new Map<string, number>();

function cacheKey(
  platform: PlatformInsightsCachePlatform,
  restaurantId: string,
  startYmd: string,
  endYmd: string,
): string {
  return `${platform}|${restaurantId}|${startYmd}|${endYmd}`;
}

export function isGoogleInsightsQuotaCooldown(restaurantId: string): boolean {
  const until = googleQuotaUntilByRestaurant.get(restaurantId) ?? 0;
  return Date.now() < until;
}

export function markGoogleInsightsQuotaExceeded(restaurantId: string): void {
  googleQuotaUntilByRestaurant.set(
    restaurantId,
    Date.now() + PLATFORM_INSIGHTS_QUOTA_COOLDOWN_MS,
  );
}

export function readPlatformInsightsCache<T>(
  platform: PlatformInsightsCachePlatform,
  restaurantId: string,
  startYmd: string,
  endYmd: string,
): T | null {
  const entry = responseCache.get(
    cacheKey(platform, restaurantId, startYmd, endYmd),
  );
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data as T;
}

export function readNewestPlatformInsightsCacheForRestaurant<T>(
  platform: PlatformInsightsCachePlatform,
  restaurantId: string,
): T | null {
  const prefix = `${platform}|${restaurantId}|`;
  let best: CacheEntry | null = null;
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (!key.startsWith(prefix) || now > entry.expiresAt) continue;
    if (!best || entry.expiresAt > best.expiresAt) best = entry;
  }
  return (best?.data as T | undefined) ?? null;
}

export function writePlatformInsightsCache<T>(
  platform: PlatformInsightsCachePlatform,
  restaurantId: string,
  startYmd: string,
  endYmd: string,
  data: T,
  shouldCache: (value: T) => boolean,
): void {
  if (!shouldCache(data)) return;
  responseCache.set(cacheKey(platform, restaurantId, startYmd, endYmd), {
    expiresAt: Date.now() + PLATFORM_INSIGHTS_CACHE_TTL_MS,
    data,
  });
}

export function isGoogleQuotaErrorMessage(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return (
    lower.includes("quota exceeded") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  );
}

export const GOOGLE_INSIGHTS_QUOTA_USER_MESSAGE =
  "Google Insights: Anfragen-Limit erreicht. Zwischengespeicherte Daten werden angezeigt — ein neuer Abruf ist frühestens am nächsten Tag möglich.";
