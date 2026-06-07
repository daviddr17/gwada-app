export type ReviewRatingInput = { rating: number };

export function averageRating(reviews: ReviewRatingInput[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function medianRating(reviews: ReviewRatingInput[]): number | null {
  if (reviews.length === 0) return null;
  const sorted = [...reviews].map((r) => r.rating).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function ratingDistribution(
  reviews: ReviewRatingInput[],
): Record<1 | 2 | 3 | 4 | 5, number> {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const k = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    dist[k] += 1;
  }
  return dist;
}
