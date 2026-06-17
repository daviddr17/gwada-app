import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  computeReviewStatistics,
  type ReviewStatsPeriod,
} from "@/lib/reviews/compute-review-statistics";
import {
  isReviewsFeedSyncStale,
  REVIEWS_CACHEABLE_PLATFORMS,
  type ReviewsCacheablePlatform,
} from "@/lib/reviews/reviews-cache-constants";
import { readReviewsPlatformSyncState } from "@/lib/reviews/reviews-cache-db";
import { reviewStatisticsPeriodRange } from "@/lib/reviews/reviews-statistics-period";
import {
  reviewStatisticsRevisionKey,
  type ReviewStatisticsRevisionResponse,
  type ReviewStatisticsRevisionSnapshot,
} from "@/lib/reviews/reviews-statistics-revision";
import {
  peekReviewStatisticsServerCache,
  writeReviewStatisticsServerCache,
} from "@/lib/reviews/reviews-statistics-server-cache";
import { reviewExternalId } from "@/lib/reviews/review-settings-types";
import { fetchAllSupabaseRows } from "@/lib/supabase/fetch-all-supabase-rows";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  ReviewAnalyticsRow,
  ReviewInvitationAnalyticsRow,
  ReviewStatisticsBundle,
  ReviewStatisticsPlatformSync,
} from "@/lib/supabase/reviews-analytics-db";
import type { SupabaseClient } from "@supabase/supabase-js";

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

const CACHE_SELECT = "platform, item, created_at";

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

function buildPlatformSyncMeta(
  platform: ReviewsCacheablePlatform,
  syncRows: Awaited<ReturnType<typeof readReviewsPlatformSyncState>>,
): ReviewStatisticsPlatformSync {
  const row = syncRows.find((entry) => entry.platform === platform);
  return {
    syncedAt: row?.synced_at ?? null,
    itemCount: row?.item_count ?? 0,
    stale: isReviewsFeedSyncStale(row?.synced_at),
    lastError: row?.last_error ?? null,
  };
}

function buildSyncMeta(
  syncRows: Awaited<ReturnType<typeof readReviewsPlatformSyncState>>,
  syncTriggered: boolean,
): ReviewStatisticsBundle["sync"] {
  return {
    google: buildPlatformSyncMeta("google", syncRows),
    facebook: buildPlatformSyncMeta("facebook", syncRows),
    syncTriggered,
  };
}

async function fetchPlatformCacheRevision(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    platform: ReviewsCacheablePlatform;
    rangeStartIso: string;
    rangeEndIso: string;
  },
): Promise<{
  countInPeriod: number;
  maxCreatedAt: string | null;
  error: string | null;
}> {
  const [countRes, latestRes] = await Promise.all([
    sb
      .from("restaurant_reviews_platform_cache")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", params.restaurantId)
      .eq("platform", params.platform)
      .gte("created_at", params.rangeStartIso)
      .lt("created_at", params.rangeEndIso),
    sb
      .from("restaurant_reviews_platform_cache")
      .select("created_at")
      .eq("restaurant_id", params.restaurantId)
      .eq("platform", params.platform)
      .gte("created_at", params.rangeStartIso)
      .lt("created_at", params.rangeEndIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const error = countRes.error?.message ?? latestRes.error?.message ?? null;
  if (error) {
    return { countInPeriod: 0, maxCreatedAt: null, error };
  }

  return {
    countInPeriod: countRes.count ?? 0,
    maxCreatedAt: (latestRes.data?.created_at as string | undefined) ?? null,
    error: null,
  };
}

async function fetchReviewStatisticsRevisionSnapshot(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    monthsBack: ReviewStatsPeriod;
    syncRows: Awaited<ReturnType<typeof readReviewsPlatformSyncState>>;
  },
): Promise<{ snapshot: ReviewStatisticsRevisionSnapshot; error: string | null }> {
  const { rangeStartIso, rangeEndIso } = reviewStatisticsPeriodRange(
    params.monthsBack,
  );

  const [
    gwadaCountRes,
    gwadaLatestRes,
    invitationCountRes,
    invitationLatestRes,
    visibilityCountRes,
    visibilityLatestRes,
    googleCacheRev,
    facebookCacheRev,
  ] = await Promise.all([
    sb
      .from("gwada_reviews")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", params.restaurantId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso),
    sb
      .from("gwada_reviews")
      .select("created_at")
      .eq("restaurant_id", params.restaurantId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("gwada_review_invitations")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", params.restaurantId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso),
    sb
      .from("gwada_review_invitations")
      .select("created_at")
      .eq("restaurant_id", params.restaurantId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("restaurant_review_visibility")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", params.restaurantId),
    sb
      .from("restaurant_review_visibility")
      .select("hidden_at")
      .eq("restaurant_id", params.restaurantId)
      .order("hidden_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchPlatformCacheRevision(sb, {
      restaurantId: params.restaurantId,
      platform: "google",
      rangeStartIso,
      rangeEndIso,
    }),
    fetchPlatformCacheRevision(sb, {
      restaurantId: params.restaurantId,
      platform: "facebook",
      rangeStartIso,
      rangeEndIso,
    }),
  ]);

  const error =
    gwadaCountRes.error?.message ??
    gwadaLatestRes.error?.message ??
    invitationCountRes.error?.message ??
    invitationLatestRes.error?.message ??
    visibilityCountRes.error?.message ??
    visibilityLatestRes.error?.message ??
    googleCacheRev.error ??
    facebookCacheRev.error ??
    null;
  if (error) {
    return { snapshot: null as never, error };
  }

  return {
    snapshot: {
      monthsBack: params.monthsBack,
      gwadaReviewCount: gwadaCountRes.count ?? 0,
      gwadaReviewMaxCreatedAt:
        (gwadaLatestRes.data?.created_at as string | undefined) ?? null,
      invitationCount: invitationCountRes.count ?? 0,
      invitationMaxCreatedAt:
        (invitationLatestRes.data?.created_at as string | undefined) ?? null,
      visibilityCount: visibilityCountRes.count ?? 0,
      visibilityMaxHiddenAt:
        (visibilityLatestRes.data?.hidden_at as string | undefined) ?? null,
      googleCacheCountInPeriod: googleCacheRev.countInPeriod,
      googleCacheMaxCreatedAt: googleCacheRev.maxCreatedAt,
      facebookCacheCountInPeriod: facebookCacheRev.countInPeriod,
      facebookCacheMaxCreatedAt: facebookCacheRev.maxCreatedAt,
    },
    error: null,
  };
}

export async function fetchReviewStatisticsRevisionServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    monthsBack?: ReviewStatsPeriod;
    syncTriggered?: boolean;
  },
): Promise<{ data: ReviewStatisticsRevisionResponse | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const monthsBack = params.monthsBack ?? 12;
  const syncRows = await readReviewsPlatformSyncState(sb, params.restaurantId, [
    ...REVIEWS_CACHEABLE_PLATFORMS,
  ]);

  const { snapshot, error } = await fetchReviewStatisticsRevisionSnapshot(sb, {
    restaurantId: params.restaurantId,
    monthsBack,
    syncRows,
  });
  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      revision: reviewStatisticsRevisionKey(snapshot),
      sync: buildSyncMeta(syncRows, params.syncTriggered ?? false),
    },
    error: null,
  };
}

async function computeReviewStatisticsBundle(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    monthsBack: ReviewStatsPeriod;
    syncRows: Awaited<ReturnType<typeof readReviewsPlatformSyncState>>;
    syncTriggered: boolean;
    revision: string;
  },
): Promise<{ data: ReviewStatisticsBundle | null; error: string | null }> {
  const { periodStart, periodEnd, rangeStartIso, rangeEndIso } =
    reviewStatisticsPeriodRange(params.monthsBack);

  const [
    gwadaResult,
    cacheResult,
    invitationsResult,
    visibilityRes,
  ] = await Promise.all([
    fetchAllSupabaseRows<Record<string, unknown>>(async (from, to) =>
      sb
        .from("gwada_reviews")
        .select(GWADA_REVIEW_SELECT)
        .eq("restaurant_id", params.restaurantId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    fetchAllSupabaseRows<Record<string, unknown>>(async (from, to) =>
      sb
        .from("restaurant_reviews_platform_cache")
        .select(CACHE_SELECT)
        .eq("restaurant_id", params.restaurantId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: true, nullsFirst: false })
        .range(from, to),
    ),
    fetchAllSupabaseRows<Record<string, unknown>>(async (from, to) =>
      sb
        .from("gwada_review_invitations")
        .select(INVITATION_SELECT)
        .eq("restaurant_id", params.restaurantId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    sb
      .from("restaurant_review_visibility")
      .select("platform, external_id")
      .eq("restaurant_id", params.restaurantId),
  ]);

  const error =
    gwadaResult.error ??
    cacheResult.error ??
    invitationsResult.error ??
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

  const gwadaReviews: ReviewAnalyticsRow[] = gwadaResult.data.map((row) => {
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
  for (const row of cacheResult.data) {
    const parsed = parseCachedReviewItem(row.item, hiddenKeys);
    if (!parsed) continue;
    cachedReviews.push(parsed);
  }

  const invitations: ReviewInvitationAnalyticsRow[] =
    invitationsResult.data.map((row) => ({
      id: row.id as string,
      created_at: row.created_at as string,
      link_sent_at: (row.link_sent_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
    }));

  const reviews = [...gwadaReviews, ...cachedReviews].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  const stats = computeReviewStatistics({
    reviews,
    invitations,
    periodStart,
    periodEnd,
  });

  const bundle: ReviewStatisticsBundle = {
    revision: params.revision,
    stats,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    sync: buildSyncMeta(params.syncRows, params.syncTriggered),
  };

  writeReviewStatisticsServerCache(
    params.restaurantId,
    params.monthsBack,
    params.revision,
    bundle,
  );

  return { data: bundle, error: null };
}

export async function fetchReviewStatisticsBundleServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    monthsBack?: ReviewStatsPeriod;
    syncTriggered?: boolean;
  },
): Promise<{ data: ReviewStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const monthsBack = params.monthsBack ?? 12;
  const syncRows = await readReviewsPlatformSyncState(sb, params.restaurantId, [
    ...REVIEWS_CACHEABLE_PLATFORMS,
  ]);

  const { snapshot, error: revisionError } =
    await fetchReviewStatisticsRevisionSnapshot(sb, {
      restaurantId: params.restaurantId,
      monthsBack,
      syncRows,
    });
  if (revisionError) {
    return { data: null, error: revisionError };
  }

  const revision = reviewStatisticsRevisionKey(snapshot);
  const cached = peekReviewStatisticsServerCache(
    params.restaurantId,
    monthsBack,
    revision,
  );
  if (cached) {
    return {
      data: {
        ...cached,
        sync: buildSyncMeta(syncRows, params.syncTriggered ?? false),
      },
      error: null,
    };
  }

  return computeReviewStatisticsBundle(sb, {
    restaurantId: params.restaurantId,
    monthsBack,
    syncRows,
    syncTriggered: params.syncTriggered ?? false,
    revision,
  });
}
