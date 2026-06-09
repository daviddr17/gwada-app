import type { ReviewPlatform } from "@/lib/constants/review-platforms";

export type ReviewReadRow = {
  platform: ReviewPlatform;
  review_id: string;
  read_at: string | null;
  marked_unread_at: string | null;
};

export function reviewReadLookupKey(
  platform: ReviewPlatform,
  reviewId: string,
): string {
  return `${platform}:${reviewId}`;
}

export function parseReviewReadLookupKey(key: string): {
  platform: ReviewPlatform;
  reviewId: string;
} | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const platform = key.slice(0, idx);
  const reviewId = key.slice(idx + 1);
  if (!reviewId) return null;
  if (platform !== "gwada" && platform !== "google" && platform !== "facebook") {
    return null;
  }
  return { platform, reviewId };
}

export function isReviewMarkedUnread(row: ReviewReadRow | undefined): boolean {
  if (!row?.marked_unread_at) return false;
  if (!row.read_at) return true;
  return (
    new Date(row.marked_unread_at).getTime() >
    new Date(row.read_at).getTime()
  );
}

/** Ohne Eintrag = ungelesen (neue Bewertung). */
export function computeReviewUnread(row: ReviewReadRow | undefined): boolean {
  if (isReviewMarkedUnread(row)) return true;
  if (!row?.read_at) return true;
  return false;
}

export type ReviewReadFilter = "all" | "unread" | "read";

export const REVIEW_READ_FILTER_OPTIONS: {
  value: ReviewReadFilter;
  label: string;
}[] = [
  { value: "all", label: "Alle" },
  { value: "unread", label: "Ungelesen" },
  { value: "read", label: "Gelesen" },
];
