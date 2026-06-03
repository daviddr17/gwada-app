export const REVIEW_PLATFORMS = ["gwada", "google", "facebook"] as const;

export type ReviewPlatform = (typeof REVIEW_PLATFORMS)[number];

export const REVIEW_PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  gwada: "Gwada",
  google: "Google",
  facebook: "Facebook",
};
