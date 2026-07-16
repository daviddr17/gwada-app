export const REVIEW_PLATFORMS = ["gwada", "google", "facebook", "tripadvisor"] as const;

export type ReviewPlatform = (typeof REVIEW_PLATFORMS)[number];

export const REVIEW_PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  gwada: "Gwada",
  google: "Google",
  facebook: "Facebook",
  tripadvisor: "TripAdvisor",
};

/** Reihenfolge in der Bewertungen-Übersicht (Gwada zuerst). */
export const REVIEW_PLATFORM_ORDER: readonly ReviewPlatform[] =
  REVIEW_PLATFORMS;

/**
 * Plattformen mit Reply-API für automatische Antworten.
 * TripAdvisor ist read-only (Terra) — nicht in Auto-Antwort-Einstellungen.
 */
export const REVIEW_AUTO_REPLY_PLATFORMS = [
  "gwada",
  "google",
  "facebook",
] as const satisfies readonly ReviewPlatform[];

export type ReviewAutoReplyPlatform =
  (typeof REVIEW_AUTO_REPLY_PLATFORMS)[number];

export function isReviewPlatform(value: string): value is ReviewPlatform {
  return (REVIEW_PLATFORMS as readonly string[]).includes(value);
}

export function isReviewAutoReplyPlatform(
  value: string,
): value is ReviewAutoReplyPlatform {
  return (REVIEW_AUTO_REPLY_PLATFORMS as readonly string[]).includes(value);
}

/** Übersicht: alle Plattformen gemischt (Chips filtern nur die Ansicht). */
export const REVIEW_FILTER_ALL = "all" as const;

export type ReviewPlatformFilter = typeof REVIEW_FILTER_ALL | ReviewPlatform;

export const REVIEW_FILTER_LABELS: Record<ReviewPlatformFilter, string> = {
  all: "Alle",
  ...REVIEW_PLATFORM_LABELS,
};

export function isReviewPlatformFilter(
  value: string,
): value is ReviewPlatformFilter {
  return value === REVIEW_FILTER_ALL || isReviewPlatform(value);
}

export function parseReviewPlatformFilter(
  platformParam: string | null,
): ReviewPlatformFilter {
  if (!platformParam || platformParam === REVIEW_FILTER_ALL) {
    return REVIEW_FILTER_ALL;
  }
  if (isReviewPlatform(platformParam)) {
    return platformParam;
  }
  return REVIEW_FILTER_ALL;
}
