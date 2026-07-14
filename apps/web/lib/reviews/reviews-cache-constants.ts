import type { ReviewPlatform } from "@/lib/constants/review-platforms";

/** Externe Plattformen, deren Bewertungen in der DB gecacht werden (Gwada bleibt in gwada_reviews). */
export const REVIEWS_CACHEABLE_PLATFORMS = [
  "google",
  "facebook",
  "tripadvisor",
] as const satisfies readonly ReviewPlatform[];

export type ReviewsCacheablePlatform = (typeof REVIEWS_CACHEABLE_PLATFORMS)[number];

/** Gleicher Rhythmus wie News — ~10 Min. pro Restaurant (Google, Facebook). */
export const REVIEWS_CACHE_STALE_MS = 10 * 60 * 1000;

/** TripAdvisor (Terra API): 1× pro Woche — Kosten pro billable entity. */
export const REVIEWS_CACHE_STALE_TRIPADVISOR_MS = 7 * 24 * 60 * 60 * 1000;

/** Nach Fehler oder leerem TripAdvisor-Cache früher erneut syncen. */
export const REVIEWS_CACHE_RETRY_MS = 60 * 60 * 1000;

export function reviewsFeedSyncStaleMs(platform: ReviewsCacheablePlatform): number {
  if (platform === "tripadvisor") return REVIEWS_CACHE_STALE_TRIPADVISOR_MS;
  return REVIEWS_CACHE_STALE_MS;
}

export type ReviewsFeedSyncStaleOpts = {
  lastError?: string | null;
  itemCount?: number | null;
};

export function isReviewsFeedSyncStale(
  syncedAt: string | null | undefined,
  platform: ReviewsCacheablePlatform,
  opts?: ReviewsFeedSyncStaleOpts,
): boolean {
  if (!syncedAt) return true;
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  if (opts?.lastError) {
    return ageMs > REVIEWS_CACHE_RETRY_MS;
  }
  if (platform === "tripadvisor" && (opts?.itemCount ?? 0) === 0) {
    return ageMs > REVIEWS_CACHE_RETRY_MS;
  }
  return ageMs > reviewsFeedSyncStaleMs(platform);
}

export function isReviewsCacheablePlatform(
  platform: ReviewPlatform,
): platform is ReviewsCacheablePlatform {
  return (REVIEWS_CACHEABLE_PLATFORMS as readonly string[]).includes(platform);
}
