import "server-only";

import { computeContactStatistics } from "@/lib/contacts/compute-contact-statistics";
import {
  computeInsightsStatistics,
  type InsightsStatsPeriod,
  type InsightsStatisticsResult,
} from "@/lib/insights/compute-insights-statistics";
import { fetchPlatformInsightsBundle } from "@/lib/insights/fetch-platform-insights-bundle";
import { fetchRestaurantUsageInsights } from "@/lib/insights/fetch-restaurant-usage-insights";
import { computeNewsStatistics } from "@/lib/news/compute-news-statistics";
import { computeReservationStats } from "@/lib/reservations/compute-reservation-stats";
import { computeReviewStatistics } from "@/lib/reviews/compute-review-statistics";
import { readReviewsPlatformSyncState } from "@/lib/reviews/reviews-cache-db";
import { reviewExternalId } from "@/lib/reviews/review-settings-types";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayKey,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { ReservationAnalyticsRow } from "@/lib/supabase/reservations-analytics-db";
import type {
  ContactAnalyticsRow,
  ContactMessageAnalyticsRow,
} from "@/lib/supabase/contact-messages-analytics-db";
import type { ReviewAnalyticsRow } from "@/lib/supabase/reviews-analytics-db";
import { fetchAllSupabaseRows } from "@/lib/supabase/fetch-all-supabase-rows";
import type { SupabaseClient } from "@supabase/supabase-js";

function periodRange(monthsBack: InsightsStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
  rangeEndIso: string;
} {
  const periodEnd = startOfLocalDay(new Date());
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return {
    periodStart,
    periodEnd,
    rangeStartIso: periodStart.toISOString(),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}

function sumNewsEngagement(items: UnifiedNewsItem[]): {
  likes: number;
  comments: number;
  views: number;
} {
  let likes = 0;
  let comments = 0;
  let views = 0;
  for (const item of items) {
    likes += item.insights?.likes ?? 0;
    comments += item.insights?.comments ?? 0;
    views += item.insights?.views ?? 0;
  }
  return { likes, comments, views };
}

/** Nur native Gwada-Reviews — Plattform-Cache bleibt Performance-Spiegel, kein Gwada-KPI. */
async function fetchGwadaReviewsOnly(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const [gwadaResult, invitationsResult, visibilityRes] = await Promise.all([
    fetchAllSupabaseRows<Record<string, unknown>>(async (from, to) =>
      admin
        .from("gwada_reviews")
        .select("id, rating, comment, created_at, reservation_id")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    fetchAllSupabaseRows<Record<string, unknown>>(async (from, to) =>
      admin
        .from("gwada_review_invitations")
        .select("id, created_at, link_sent_at, completed_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    admin
      .from("restaurant_review_visibility")
      .select("platform, external_id")
      .eq("restaurant_id", restaurantId),
  ]);

  const error =
    gwadaResult.error ??
    invitationsResult.error ??
    visibilityRes.error?.message ??
    null;
  if (error) {
    return { data: null as ReturnType<typeof computeReviewStatistics> | null, error };
  }

  const hiddenKeys = new Set(
    (visibilityRes.data ?? []).map(
      (row) => `${row.platform as string}:${row.external_id as string}`,
    ),
  );

  const reviews: ReviewAnalyticsRow[] = gwadaResult.data.map((row) => {
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

  const invitations = invitationsResult.data.map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    link_sent_at: (row.link_sent_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
  }));

  return {
    data: computeReviewStatistics({
      reviews,
      invitations,
      periodStart,
      periodEnd,
    }),
    error: null,
  };
}

async function fetchReservationsAdmin(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
): Promise<ReservationAnalyticsRow[]> {
  const { data, error } = await admin
    .from("reservations")
    .select(
      "id, created_at, starts_at, party_size, reservation_statuses ( code, name, color_hex )",
    )
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", rangeStartIso)
    .order("starts_at", { ascending: true });

  if (error) {
    console.warn("insights statistics reservations", error.message);
    return [];
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const st = row.reservation_statuses;
    const status = Array.isArray(st) ? (st[0] ?? null) : st;
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      starts_at: row.starts_at as string,
      party_size: row.party_size as number,
      reservation_statuses:
        status as ReservationAnalyticsRow["reservation_statuses"],
    };
  });
}

async function fetchContactBundleAdmin(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{
  messages: ContactMessageAnalyticsRow[];
  contacts: ContactAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
}> {
  const [messagesRes, contactsRes, reservationsRes] = await Promise.all([
    admin
      .from("contact_messages")
      .select(
        "id, contact_id, platform, direction, created_at, reservation_id",
      )
      .eq("restaurant_id", restaurantId)
      .eq("platform", "gwada")
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso)
      .order("created_at", { ascending: true }),
    admin
      .from("contacts")
      .select(
        "id, first_name, last_name, company, created_at, last_interaction_at, contact_emails ( id ), contact_phones ( id ), contact_messaging_ids ( id )",
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false }),
    admin
      .from("reservations")
      .select("contact_id")
      .eq("restaurant_id", restaurantId)
      .not("contact_id", "is", null),
  ]);

  if (messagesRes.error) {
    console.warn("insights statistics messages", messagesRes.error.message);
  }
  if (contactsRes.error) {
    console.warn("insights statistics contacts", contactsRes.error.message);
  }

  const reservationCountByContact = new Map<string, number>();
  for (const row of reservationsRes.data ?? []) {
    const contactId = (row as { contact_id: string | null }).contact_id;
    if (!contactId) continue;
    reservationCountByContact.set(
      contactId,
      (reservationCountByContact.get(contactId) ?? 0) + 1,
    );
  }

  const messages = (messagesRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: row.id as string,
      contact_id: row.contact_id as string,
      platform: row.platform as ContactMessageAnalyticsRow["platform"],
      direction: row.direction as ContactMessageAnalyticsRow["direction"],
      created_at: row.created_at as string,
      reservation_id: (row.reservation_id as string | null) ?? null,
    };
  });

  const contacts = (contactsRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const emails = row.contact_emails as unknown[] | null;
    const phones = row.contact_phones as unknown[] | null;
    const messaging = row.contact_messaging_ids as unknown[] | null;
    const id = row.id as string;
    return {
      id,
      first_name: row.first_name as string,
      last_name: row.last_name as string,
      company: (row.company as string | null) ?? null,
      created_at: row.created_at as string,
      last_interaction_at: (row.last_interaction_at as string | null) ?? null,
      reservation_count: reservationCountByContact.get(id) ?? 0,
      message_count: 0,
      has_email: (emails?.length ?? 0) > 0,
      has_phone: (phones?.length ?? 0) > 0,
      has_messaging: (messaging?.length ?? 0) > 0,
    };
  });

  return { messages, contacts, periodStart, periodEnd };
}

async function fetchNewsItemsAdmin(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
): Promise<UnifiedNewsItem[]> {
  const gwadaRes = await admin
    .from("gwada_news_posts")
    .select(
      "id, title, body, status, created_at, published_at, scheduled_at, media",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  const items: UnifiedNewsItem[] = [];

  for (const raw of gwadaRes.data ?? []) {
    const row = raw as Record<string, unknown>;
    const status = row.status as UnifiedNewsItem["status"];
    const media = Array.isArray(row.media) ? row.media : [];
    items.push({
      id: `gwada:${row.id as string}`,
      platform: "gwada",
      source: "gwada",
      postId: row.id as string,
      title: (row.title as string | null) ?? null,
      body: (row.body as string) ?? "",
      media: media as UnifiedNewsItem["media"],
      createdAt: row.created_at as string,
      publishedAt: (row.published_at as string | null) ?? null,
      scheduledAt: (row.scheduled_at as string | null) ?? null,
      status,
      canEdit: status !== "archived",
      canDelete: true,
      externalUrl: null,
      insights: null,
      authorName: null,
    });
  }

  return items;
}

export async function fetchInsightsStatistics(
  sb: SupabaseClient,
  restaurantId: string,
  monthsBack: InsightsStatsPeriod = 12,
): Promise<{ data: InsightsStatisticsResult | null; error: string | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: null, error: "invalid_request" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { data: null, error: "server_misconfigured" };

  const { periodStart, periodEnd, rangeStartIso, rangeEndIso } =
    periodRange(monthsBack);

  const flags = await fetchPlatformMessagingFlags(sb);
  const startYmd = localDayKey(periodStart);
  const endYmd = localDayKey(periodEnd);

  const [
    gwadaReviewsRes,
    reservationRows,
    contactBundle,
    newsItems,
    syncRes,
    usage,
    platforms,
    tripConfig,
    reviewSyncRows,
  ] = await Promise.all([
    fetchGwadaReviewsOnly(
      admin,
      restaurantId,
      rangeStartIso,
      rangeEndIso,
      periodStart,
      periodEnd,
    ),
    fetchReservationsAdmin(admin, restaurantId, rangeStartIso),
    fetchContactBundleAdmin(
      admin,
      restaurantId,
      rangeStartIso,
      rangeEndIso,
      periodStart,
      periodEnd,
    ),
    fetchNewsItemsAdmin(admin, restaurantId),
    admin
      .from("restaurant_news_platform_sync")
      .select("platform, item_count, synced_at, last_error")
      .eq("restaurant_id", restaurantId),
    fetchRestaurantUsageInsights({
      restaurantId,
      startYmd,
      endYmd,
    }),
    fetchPlatformInsightsBundle({
      restaurantId,
      startYmd,
      endYmd,
      flags,
    }),
    flags.tripadvisorEnabled
      ? fetchRestaurantTripadvisorConfigAdmin(restaurantId)
      : Promise.resolve(null),
    readReviewsPlatformSyncState(sb, restaurantId, ["tripadvisor"]),
  ]);

  if (gwadaReviewsRes.error) {
    return { data: null, error: gwadaReviewsRes.error };
  }
  if (!gwadaReviewsRes.data) {
    return { data: null, error: "statistics_unavailable" };
  }

  const reservations = computeReservationStats(reservationRows);
  const messages = computeContactStatistics({
    messages: contactBundle.messages,
    contacts: contactBundle.contacts,
    periodStart: contactBundle.periodStart,
    periodEnd: contactBundle.periodEnd,
  });
  const news = computeNewsStatistics({
    items: newsItems,
    syncRows: (syncRes.data ?? []).map((row) => ({
      platform: (row as { platform: string }).platform as import("@/lib/constants/news-platforms").NewsPlatform,
      item_count: (row as { item_count: number }).item_count,
      synced_at: (row as { synced_at: string | null }).synced_at,
      last_error: (row as { last_error: string | null }).last_error,
    })),
    periodStart,
    periodEnd,
  });

  const newsInPeriod = newsItems.filter((item) => {
    const iso = item.publishedAt ?? item.createdAt;
    const t = new Date(iso).getTime();
    return t >= periodStart.getTime() && t <= periodEnd.getTime();
  });
  const newsEngagement = sumNewsEngagement(newsInPeriod);

  const tripSync = reviewSyncRows.find((row) => row.platform === "tripadvisor");
  const tripadvisor: InsightsStatisticsResult["tripadvisor"] = {
    connected: tripConfig?.status === "working",
    reviewCount:
      tripSync?.meta.totalReviewCount ?? tripSync?.item_count ?? 0,
    averageRating:
      typeof tripSync?.meta.averageRating === "number"
        ? tripSync.meta.averageRating
        : null,
  };

  return {
    data: computeInsightsStatistics({
      periodMonths: monthsBack,
      periodStart,
      periodEnd,
      reservations,
      reviews: gwadaReviewsRes.data,
      messages,
      news,
      newsEngagement,
      usage,
      platforms,
      tripadvisor,
    }),
    error: null,
  };
}
