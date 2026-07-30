export type ReviewRatingInput = { rating: number };

export type ReviewRatingSummaryScope =
  | "google_location"
  | "page"
  | "filtered"
  | "all";

export type ReviewRatingSummary = {
  count: number;
  average: number | null;
  median: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  scope?: ReviewRatingSummaryScope;
};

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

export type BuildReviewRatingSummaryOptions = {
  /**
   * Offizielle Plattform-Gesamtzahl (z. B. Google `totalReviewCount`), wenn der
   * lokale Cache nur eine Teilmenge hält.
   */
  officialCount?: number | null;
  /** Offizieller Plattform-Durchschnitt (Google), falls vorhanden. */
  officialAverage?: number | null;
};

/** Ø / Median / Sterne-Verteilung; Anzahl/Ø können aus Plattform-Meta kommen. */
export function buildReviewRatingSummary(
  reviews: readonly ReviewRatingInput[],
  scope?: ReviewRatingSummaryScope,
  options?: BuildReviewRatingSummaryOptions,
): ReviewRatingSummary {
  const sampleCount = reviews.length;
  const officialCount =
    typeof options?.officialCount === "number" &&
    Number.isFinite(options.officialCount) &&
    options.officialCount > sampleCount
      ? Math.round(options.officialCount)
      : null;
  const officialAverage =
    typeof options?.officialAverage === "number" &&
    Number.isFinite(options.officialAverage)
      ? Math.round(options.officialAverage * 10) / 10
      : null;

  return {
    count: officialCount ?? sampleCount,
    average: officialAverage ?? averageRating([...reviews]),
    median: medianRating([...reviews]),
    distribution: ratingDistribution([...reviews]),
    ...(scope ? { scope } : {}),
  };
}
