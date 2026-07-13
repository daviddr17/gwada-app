import type { ReviewPlatform } from "@/lib/constants/review-platforms";

/** Externe Plattformen, deren Bewertungen in der DB gecacht werden (Gwada bleibt in gwada_reviews). */
export const REVIEWS_CACHEABLE_PLATFORMS = [
  "google",
  "facebook",
  "tripadvisor",
] as const satisfies readonly ReviewPlatform[];

export type ReviewsCacheablePlatform = (typeof REVIEWS_CACHEABLE_PLATFORMS)[number];

/** Gleicher Rhythmus wie News — ~10 Min. pro Restaurant. */
export const REVIEWS_CACHE_STALE_MS = 10 * 60 * 1000;

export function isReviewsFeedSyncStale(
  syncedAt: string | null | undefined,
): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > REVIEWS_CACHE_STALE_MS;
}

export function isReviewsCacheablePlatform(
  platform: ReviewPlatform,
): platform is ReviewsCacheablePlatform {
  return (REVIEWS_CACHEABLE_PLATFORMS as readonly string[]).includes(platform);
}
