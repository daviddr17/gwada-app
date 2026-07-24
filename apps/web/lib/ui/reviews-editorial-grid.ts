/**
 * Bewertungs-Raster: chronologisch zeilenweise (nicht CSS-Columns-Masonry).
 * Hervorgehobene Karten spannen volle Breite für Rhythmus ohne Lesereihenfolge zu zerstören.
 */

export const reviewsEditorialGridClassName =
  "grid grid-cols-1 gap-4 sm:grid-cols-2";

/** Volle Breite ab sm — Featured-Karten. */
export const reviewsEditorialFeaturedClassName = "sm:col-span-2";

/** Ab dieser Kommentarlänge zählen 5★ als Featured (kurze „Super!“ bleiben normal). */
export const REVIEWS_EDITORIAL_FEATURED_COMMENT_MIN_CHARS = 100;

export function isReviewsEditorialFeatured(
  review: {
    rating: number;
    comment?: string | null;
    isPinned?: boolean | null;
  },
  opts?: { isUnread?: boolean },
): boolean {
  if (review.isPinned) return true;
  if (opts?.isUnread) return true;
  const comment = review.comment?.trim() ?? "";
  if (
    Math.round(review.rating) >= 5 &&
    comment.length >= REVIEWS_EDITORIAL_FEATURED_COMMENT_MIN_CHARS
  ) {
    return true;
  }
  return false;
}
