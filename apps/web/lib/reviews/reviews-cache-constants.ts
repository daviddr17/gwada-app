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

export function reviewsFeedSyncStaleMs(platform: ReviewsCacheablePlatform): number {
  if (platform === "tripadvisor") return REVIEWS_CACHE_STALE_TRIPADVISOR_MS;
  return REVIEWS_CACHE_STALE_MS;
}

export function isReviewsFeedSyncStale(
  syncedAt: string | null | undefined,
  platform: ReviewsCacheablePlatform,
): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > reviewsFeedSyncStaleMs(platform);
}

export function isReviewsCacheablePlatform(
  platform: ReviewPlatform,
): platform is ReviewsCacheablePlatform {
  return (REVIEWS_CACHEABLE_PLATFORMS as readonly string[]).includes(platform);
}
