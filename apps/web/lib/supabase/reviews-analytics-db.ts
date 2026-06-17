import type {
  ReviewStatisticsResult,
  ReviewStatsPeriod,
} from "@/lib/reviews/compute-review-statistics";

export type ReviewAnalyticsRow = {
  id: string;
  platform: import("@/lib/constants/review-platforms").ReviewPlatform;
  rating: number;
  created_at: string;
  has_comment: boolean;
  has_reply: boolean;
  reservation_id: string | null;
  hidden_from_public: boolean;
};

export type ReviewInvitationAnalyticsRow = {
  id: string;
  created_at: string;
  link_sent_at: string | null;
  completed_at: string | null;
};

export type ReviewStatisticsPlatformSync = {
  syncedAt: string | null;
  itemCount: number;
  stale: boolean;
  lastError: string | null;
};

export type ReviewStatisticsSyncMeta = {
  google: ReviewStatisticsPlatformSync;
  facebook: ReviewStatisticsPlatformSync;
  /** Wird vom API-Handler gesetzt, wenn ein Hintergrund-Sync angestoßen wurde. */
  syncTriggered: boolean;
};

/** Aggregiertes API-Bundle — keine Rohzeilen mehr ans Frontend. */
export type ReviewStatisticsBundle = {
  revision: string;
  stats: ReviewStatisticsResult;
  periodStart: string;
  periodEnd: string;
  sync: ReviewStatisticsSyncMeta;
};

export type { ReviewStatsPeriod };
