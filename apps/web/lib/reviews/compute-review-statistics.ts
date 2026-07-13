import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import type {
  ReviewAnalyticsRow,
  ReviewInvitationAnalyticsRow,
} from "@/lib/supabase/reviews-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type ReviewStatsPeriod = 3 | 6 | 12;

const PLATFORM_COLORS: Record<ReviewPlatform, string> = {
  gwada: "var(--accent)",
  google: "var(--chart-1)",
  facebook: "var(--chart-2)",
  tripadvisor: "var(--chart-3)",
};

const STAR_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "var(--chart-5)",
  2: "var(--chart-4)",
  3: "var(--chart-3)",
  4: "var(--chart-2)",
  5: "var(--chart-1)",
};

export type ReviewStatisticsInput = {
  reviews: ReviewAnalyticsRow[];
  invitations: ReviewInvitationAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

export type ReviewStatisticsResult = {
  totalReviews: number;
  averageRating: number | null;
  medianRating: number | null;
  fiveStarCount: number;
  lowRatingCount: number;
  withCommentCount: number;
  withReplyCount: number;
  hiddenCount: number;
  reservationLinkedCount: number;
  topPlatform: string | null;
  invitationsCreated: number;
  invitationsLinkSent: number;
  invitationsCompleted: number;
  invitationConversionPercent: number | null;
  byPlatform: Array<{
    platform: ReviewPlatform;
    label: string;
    count: number;
    average: number | null;
    color: string;
  }>;
  byStar: Array<{ star: string; starNum: number; count: number; fill: string }>;
  byMonth: Array<{ month: string; count: number }>;
  byMonthAverage: Array<{ month: string; average: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
};

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function computeReviewStatistics(
  input: ReviewStatisticsInput,
): ReviewStatisticsResult {
  const reviews = input.reviews;
  const dist = ratingDistribution(reviews);
  const fiveStarCount = dist[5];
  const lowRatingCount = dist[1] + dist[2];

  const platformGroups = new Map<ReviewPlatform, ReviewAnalyticsRow[]>();
  for (const r of reviews) {
    const list = platformGroups.get(r.platform) ?? [];
    list.push(r);
    platformGroups.set(r.platform, list);
  }
  const byPlatform = (
    Object.keys(REVIEW_PLATFORM_LABELS) as ReviewPlatform[]
  )
    .map((platform) => {
      const rows = platformGroups.get(platform) ?? [];
      return {
        platform,
        label: REVIEW_PLATFORM_LABELS[platform],
        count: rows.length,
        average: averageRating(rows),
        color: PLATFORM_COLORS[platform],
      };
    })
    .filter((row) => row.count > 0);
  const topPlatformEntry = [...byPlatform].sort((a, b) => b.count - a.count)[0];
  const topPlatform =
    topPlatformEntry && topPlatformEntry.count > 0
      ? topPlatformEntry.label
      : null;

  const byStar = ([5, 4, 3, 2, 1] as const).map((starNum) => ({
    starNum,
    star: `${starNum} ★`,
    count: dist[starNum],
    fill: STAR_COLORS[starNum],
  }));

  const monthCounts = new Map<string, number>();
  const monthRatingSums = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const key = monthKey(r.created_at);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    const prev = monthRatingSums.get(key) ?? { sum: 0, count: 0 };
    monthRatingSums.set(key, {
      sum: prev.sum + r.rating,
      count: prev.count + 1,
    });
  }
  const monthKeys = [...monthCounts.keys()].sort();
  const byMonth = monthKeys.map((key) => ({
    month: formatMonthLabel(key),
    count: monthCounts.get(key) ?? 0,
  }));
  const byMonthAverage = monthKeys
    .map((key) => {
      const agg = monthRatingSums.get(key);
      if (!agg || agg.count === 0) return null;
      return {
        month: formatMonthLabel(key),
        average: Math.round((agg.sum / agg.count) * 10) / 10,
      };
    })
    .filter((row): row is { month: string; average: number } => row != null);

  const weekdayCounts = new Map<number, number>();
  for (const r of reviews) {
    const d = new Date(r.created_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  const invitationsCreated = input.invitations.length;
  const invitationsLinkSent = input.invitations.filter(
    (i) => i.link_sent_at != null,
  ).length;
  const invitationsCompleted = input.invitations.filter(
    (i) => i.completed_at != null,
  ).length;
  const invitationConversionPercent =
    invitationsLinkSent > 0
      ? Math.round((invitationsCompleted / invitationsLinkSent) * 100)
      : null;

  return {
    totalReviews: reviews.length,
    averageRating: averageRating(reviews),
    medianRating: medianRating(reviews),
    fiveStarCount,
    lowRatingCount,
    withCommentCount: reviews.filter((r) => r.has_comment).length,
    withReplyCount: reviews.filter((r) => r.has_reply).length,
    hiddenCount: reviews.filter((r) => r.hidden_from_public).length,
    reservationLinkedCount: reviews.filter((r) => r.reservation_id != null)
      .length,
    topPlatform,
    invitationsCreated,
    invitationsLinkSent,
    invitationsCompleted,
    invitationConversionPercent,
    byPlatform,
    byStar,
    byMonth,
    byMonthAverage,
    byWeekday,
  };
}

export function formatReviewRating(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1).replace(".", ",");
}
