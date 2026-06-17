import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import type { ReviewStatsPeriod } from "@/lib/reviews/compute-review-statistics";
import { reviewExternalId } from "@/lib/reviews/review-settings-types";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ReviewAnalyticsRow = {
  id: string;
  platform: ReviewPlatform;
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

export type ReviewStatisticsBundle = {
  reviews: ReviewAnalyticsRow[];
  invitations: ReviewInvitationAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

const GWADA_REVIEW_SELECT = `
  id,
  rating,
  comment,
  created_at,
  reservation_id
`;

const INVITATION_SELECT = `
  id,
  created_at,
  link_sent_at,
  completed_at
`;

function periodRange(monthsBack: ReviewStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
  rangeEndIso: string;
} {
  const periodEnd = startOfLocalDay(new Date());
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return {
    periodStart,
    periodEnd,
    rangeStartIso: periodStart.toISOString(),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}

function inPeriod(iso: string, rangeStartIso: string, rangeEndIso: string): boolean {
  return iso >= rangeStartIso && iso < rangeEndIso;
}

function parseCachedReviewItem(
  raw: unknown,
  hiddenKeys: Set<string>,
): ReviewAnalyticsRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.rating !== "number" || typeof o.createdAt !== "string") {
    return null;
  }
  const platform = o.platform as ReviewPlatform;
  if (platform !== "google" && platform !== "facebook") return null;
  const id = o.id;
  const externalId = reviewExternalId({ id, platform });
  return {
    id,
    platform,
    rating: o.rating,
    created_at: o.createdAt,
    has_comment: Boolean((o.comment as string | null)?.trim()),
    has_reply: Boolean((o.reply as string | null)?.trim()),
    reservation_id: (o.reservationId as string | null) ?? null,
    hidden_from_public: hiddenKeys.has(`${platform}:${externalId}`),
  };
}

export async function fetchReviewStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: ReviewStatsPeriod;
}): Promise<{ data: ReviewStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd, rangeStartIso, rangeEndIso } =
    periodRange(months);

  const sb = createSupabaseBrowserClient();
  const [gwadaRes, cacheRes, invitationsRes, visibilityRes] = await Promise.all([
    sb
      .from("gwada_reviews")
      .select(GWADA_REVIEW_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso)
      .order("created_at", { ascending: true }),
    sb
      .from("restaurant_reviews_platform_cache")
      .select("platform, item, created_at")
      .eq("restaurant_id", params.restaurantId),
    sb
      .from("gwada_review_invitations")
      .select(INVITATION_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso)
      .order("created_at", { ascending: true }),
    sb
      .from("restaurant_review_visibility")
      .select("platform, external_id")
      .eq("restaurant_id", params.restaurantId),
  ]);

  const error =
    gwadaRes.error?.message ??
    cacheRes.error?.message ??
    invitationsRes.error?.message ??
    visibilityRes.error?.message ??
    null;
  if (error) {
    return { data: null, error };
  }

  const hiddenKeys = new Set(
    (visibilityRes.data ?? []).map(
      (row) => `${row.platform as string}:${row.external_id as string}`,
    ),
  );

  const gwadaReviews: ReviewAnalyticsRow[] = (gwadaRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const id = row.id as string;
    const platform = "gwada" as const;
    const externalId = reviewExternalId({ id, platform });
    return {
      id,
      platform,
      rating: Number(row.rating),
      created_at: row.created_at as string,
      has_comment: Boolean((row.comment as string | null)?.trim()),
      has_reply: false,
      reservation_id: (row.reservation_id as string | null) ?? null,
      hidden_from_public: hiddenKeys.has(`${platform}:${externalId}`),
    };
  });

  const cachedReviews: ReviewAnalyticsRow[] = [];
  for (const row of cacheRes.data ?? []) {
    const parsed = parseCachedReviewItem(row.item, hiddenKeys);
    if (!parsed) continue;
    if (!inPeriod(parsed.created_at, rangeStartIso, rangeEndIso)) continue;
    cachedReviews.push(parsed);
  }

  const invitations: ReviewInvitationAnalyticsRow[] = (
    invitationsRes.data ?? []
  ).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      link_sent_at: (row.link_sent_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
    };
  });

  return {
    data: {
      reviews: [...gwadaReviews, ...cachedReviews].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
      invitations,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
