import type { ReviewStatsPeriod } from "@/lib/reviews/compute-review-statistics";
import type { ReviewStatisticsSyncMeta } from "@/lib/supabase/reviews-analytics-db";

/** Leichte Metadaten — entscheidet, ob sich aggregierte Statistiken geändert haben können. */
export type ReviewStatisticsRevisionSnapshot = {
  monthsBack: ReviewStatsPeriod;
  gwadaReviewCount: number;
  gwadaReviewMaxCreatedAt: string | null;
  invitationCount: number;
  invitationMaxCreatedAt: string | null;
  visibilityCount: number;
  visibilityMaxHiddenAt: string | null;
  googleCacheCountInPeriod: number;
  googleCacheMaxCreatedAt: string | null;
  facebookCacheCountInPeriod: number;
  facebookCacheMaxCreatedAt: string | null;
};

export type ReviewStatisticsRevisionResponse = {
  revision: string;
  sync: ReviewStatisticsSyncMeta;
};

export function reviewStatisticsRevisionKey(
  snapshot: ReviewStatisticsRevisionSnapshot,
): string {
  return [
    snapshot.monthsBack,
    snapshot.gwadaReviewCount,
    snapshot.gwadaReviewMaxCreatedAt ?? "",
    snapshot.invitationCount,
    snapshot.invitationMaxCreatedAt ?? "",
    snapshot.visibilityCount,
    snapshot.visibilityMaxHiddenAt ?? "",
    snapshot.googleCacheCountInPeriod,
    snapshot.googleCacheMaxCreatedAt ?? "",
    snapshot.facebookCacheCountInPeriod,
    snapshot.facebookCacheMaxCreatedAt ?? "",
  ].join("|");
}
