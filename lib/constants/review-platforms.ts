export const REVIEW_PLATFORMS = ["gwada", "google", "facebook"] as const;

export type ReviewPlatform = (typeof REVIEW_PLATFORMS)[number];

export const REVIEW_PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  gwada: "Gwada",
  google: "Google",
  facebook: "Facebook",
};

/** Reihenfolge in der Bewertungen-Übersicht (Gwada zuerst). */
export const REVIEW_PLATFORM_ORDER: readonly ReviewPlatform[] =
  REVIEW_PLATFORMS;

export function isReviewPlatform(value: string): value is ReviewPlatform {
  return (REVIEW_PLATFORMS as readonly string[]).includes(value);
}
