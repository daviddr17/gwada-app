import "server-only";

import type { GoogleBusinessPlatformInsights } from "@/lib/insights/platform-insights-types";

/** Google Performance aktualisiert sich täglich (2–3 Tage Verzögerung) — 45 Min Cache reicht. */
export const GOOGLE_INSIGHTS_CACHE_TTL_MS = 45 * 60 * 1000;

/** Nach Quota-Fehler keine Google-Calls für 10 Min (Circuit Breaker). */
export const GOOGLE_INSIGHTS_QUOTA_COOLDOWN_MS = 10 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  data: GoogleBusinessPlatformInsights;
};

const responseCache = new Map<string, CacheEntry>();
const quotaUntilByRestaurant = new Map<string, number>();

function cacheKey(
  restaurantId: string,
  startYmd: string,
  endYmd: string,
): string {
  return `${restaurantId}|${startYmd}|${endYmd}`;
}

export function isGoogleInsightsQuotaCooldown(restaurantId: string): boolean {
  const until = quotaUntilByRestaurant.get(restaurantId) ?? 0;
  return Date.now() < until;
}

export function markGoogleInsightsQuotaExceeded(restaurantId: string): void {
  quotaUntilByRestaurant.set(
    restaurantId,
    Date.now() + GOOGLE_INSIGHTS_QUOTA_COOLDOWN_MS,
  );
}

export function readGoogleInsightsCache(
  restaurantId: string,
  startYmd: string,
  endYmd: string,
): GoogleBusinessPlatformInsights | null {
  const entry = responseCache.get(
    cacheKey(restaurantId, startYmd, endYmd),
  );
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data;
}

/** Älteste gecachte Antwort für Restaurant (Quota-Fallback). */
export function readNewestGoogleInsightsCacheForRestaurant(
  restaurantId: string,
): GoogleBusinessPlatformInsights | null {
  const prefix = `${restaurantId}|`;
  let best: CacheEntry | null = null;
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (!key.startsWith(prefix) || now > entry.expiresAt) continue;
    if (!best || entry.expiresAt > best.expiresAt) best = entry;
  }
  return best?.data ?? null;
}

export function writeGoogleInsightsCache(
  restaurantId: string,
  startYmd: string,
  endYmd: string,
  data: GoogleBusinessPlatformInsights,
): void {
  if (!data.connected || data.error) return;
  responseCache.set(cacheKey(restaurantId, startYmd, endYmd), {
    expiresAt: Date.now() + GOOGLE_INSIGHTS_CACHE_TTL_MS,
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
  "Google Insights: Anfragen-Limit erreicht (zu viele Abrufe pro Minute). Bitte in einigen Minuten erneut versuchen — zwischengespeicherte Daten werden angezeigt, falls vorhanden.";
