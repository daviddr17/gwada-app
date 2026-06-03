export const GOOGLE_REVIEWS_PAGE_SIZE = 50;

export function googleReviewsTotalPages(totalReviewCount: number): number {
  if (totalReviewCount <= 0) return 1;
  return Math.ceil(totalReviewCount / GOOGLE_REVIEWS_PAGE_SIZE);
}

export type GoogleReviewsPaginationMeta = {
  pageSize: number;
  totalReviewCount: number;
  nextPageToken: string | null;
  averageRating: number | null;
};
