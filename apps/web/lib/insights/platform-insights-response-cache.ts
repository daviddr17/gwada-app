import "server-only";

/** Erfolgreiche Plattform-Insights: max. 1 Live-Abruf / Tag / Zeitraum. */
export const PLATFORM_INSIGHTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Nach echtem HTTP 429 nur kurz keine Live-Calls (nicht 24h).
 * Langer In-Memory-Lock war nach Deploy/ohne Cache dauerhaft falsch sichtbar.
 */
export const PLATFORM_INSIGHTS_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;

/** Abgelaufene Cache-Einträge als Fallback höchstens so lange nutzen. */
export const PLATFORM_INSIGHTS_STALE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PlatformInsightsCachePlatform = "google" | "facebook" | "instagram";

type CacheEntry = {
  expiresAt: number;
  writtenAt: number;
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

export function clearGoogleInsightsQuotaCooldown(restaurantId: string): void {
  googleQuotaUntilByRestaurant.delete(restaurantId);
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

function pickNewestEntry(
  platform: PlatformInsightsCachePlatform,
  restaurantId: string,
  allowExpired: boolean,
): CacheEntry | null {
  const prefix = `${platform}|${restaurantId}|`;
  let best: CacheEntry | null = null;
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (!key.startsWith(prefix)) continue;
    if (!allowExpired && now > entry.expiresAt) continue;
    if (
      allowExpired &&
      now - entry.writtenAt > PLATFORM_INSIGHTS_STALE_MAX_AGE_MS
    ) {
      continue;
    }
    if (!best || entry.writtenAt > best.writtenAt) best = entry;
  }
  return best;
}

export function readNewestPlatformInsightsCacheForRestaurant<T>(
  platform: PlatformInsightsCachePlatform,
  restaurantId: string,
): T | null {
  return (
    (pickNewestEntry(platform, restaurantId, false)?.data as T | undefined) ??
    null
  );
}

/** Auch abgelaufene Einträge — Fallback wenn Live fehlschlägt / kurz 429. */
export function readStalePlatformInsightsCacheForRestaurant<T>(
  platform: PlatformInsightsCachePlatform,
  restaurantId: string,
): T | null {
  return (
    (pickNewestEntry(platform, restaurantId, true)?.data as T | undefined) ??
    null
  );
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
  const now = Date.now();
  responseCache.set(cacheKey(platform, restaurantId, startYmd, endYmd), {
    expiresAt: now + PLATFORM_INSIGHTS_CACHE_TTL_MS,
    writtenAt: now,
    data,
  });
}

export function isGoogleQuotaErrorMessage(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return (
    lower.includes("quota exceeded") ||
    /\brate limit\b/.test(lower) ||
    lower.includes("resource_exhausted") ||
    /\btoo many requests\b/.test(lower) ||
    /\b429\b/.test(lower) ||
    lower.endsWith("_429")
  );
}

/** Kurzer Hinweis nur bei echtem HTTP 429. */
export const GOOGLE_INSIGHTS_RATE_LIMIT_MESSAGE =
  "Google Insights: Zu viele Anfragen. Bitte in ein paar Minuten erneut versuchen.";

/**
 * Unspezifisches Kontingent (oft API-Quota 0 / Cloud-Projekt) — kein „Tageslimit“.
 * Performance-API dokumentiert vor allem Anfragen/Minute, kein festes Tageslimit.
 */
export const GOOGLE_INSIGHTS_QUOTA_NO_CACHE_MESSAGE =
  "Google Insights: Abruf derzeit nicht möglich (Google-Kontingent/API). Bitte später erneut versuchen.";

/** @deprecated Alias */
export const GOOGLE_INSIGHTS_QUOTA_WITH_CACHE_MESSAGE =
  GOOGLE_INSIGHTS_RATE_LIMIT_MESSAGE;

/** @deprecated Alias */
export const GOOGLE_INSIGHTS_QUOTA_USER_MESSAGE =
  GOOGLE_INSIGHTS_QUOTA_NO_CACHE_MESSAGE;
