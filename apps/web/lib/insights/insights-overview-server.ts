import "server-only";

import {
  type InsightsFetchRangeParams,
  type InsightsPeriodDays,
  resolveInsightsRange,
} from "@/lib/insights/insights-date-range";
import { fetchPlatformInsightsBundle } from "@/lib/insights/fetch-platform-insights-bundle";
import { formatInsightCount } from "@/lib/insights/platform-insights-types";
import { formatReviewRating } from "@/lib/reviews/compute-review-statistics";
import { readReviewsFeedFromCache } from "@/lib/reviews/reviews-feed-read-server";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";
import { fetchRestaurantAppleBusinessConnectConfigAdmin } from "@/lib/supabase/restaurant-apple-business-connect-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { InsightsPeriodDays } from "@/lib/insights/insights-date-range";

export type InsightsPlatformMetric = {
  label: string;
  value: string;
};

export type InsightsPlatformCard = {
  id:
    | "google_business"
    | "facebook"
    | "instagram"
    | "tripadvisor"
    | "apple_business_connect";
  label: string;
  connected: boolean;
  enabled: boolean;
  insightsAvailable: boolean;
  hint: string;
  metrics: InsightsPlatformMetric[];
};

export type InsightsOverviewPayload = {
  periodMode: "preset" | "custom";
  periodDays: InsightsPeriodDays | null;
  periodStartYmd: string;
  periodEndYmd: string;
  periodStart: string;
  periodEnd: string;
  gwada: {
    reservations: { count: number; guests: number };
    reviews: { count: number; avgRating: number | null };
    messages: { inbound: number };
    news: { published: number; likes: number; comments: number };
  };
  platforms: InsightsPlatformCard[];
};

function parseNewsCachedItem(raw: unknown): UnifiedNewsItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.body !== "string") return null;
  return raw as UnifiedNewsItem;
}

async function countReservations(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ count: number; guests: number }> {
  const { data, error } = await admin
    .from("reservations")
    .select("party_size")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndIso);

  if (error) {
    console.warn("insights reservations", error.message);
    return { count: 0, guests: 0 };
  }

  const rows = data ?? [];
  return {
    count: rows.length,
    guests: rows.reduce((sum, row) => sum + (row.party_size ?? 0), 0),
  };
}

async function countAllReviews(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  sb: SupabaseClient,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ count: number; avgRating: number | null }> {
  const startMs = new Date(rangeStartIso).getTime();
  const endMs = new Date(rangeEndIso).getTime();

  const [{ data: gwadaRows, error: gwadaError }, { reviews: cachedReviews }] =
    await Promise.all([
      admin
        .from("gwada_reviews")
        .select("rating")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndIso),
      readReviewsFeedFromCache(restaurantId, sb),
    ]);

  if (gwadaError) {
    console.warn("insights gwada reviews", gwadaError.message);
  }

  const ratings: number[] = (gwadaRows ?? [])
    .map((row) => row.rating)
    .filter((rating): rating is number => typeof rating === "number");

  for (const review of cachedReviews) {
    const t = new Date(review.createdAt).getTime();
    if (t < startMs || t >= endMs) continue;
    ratings.push(review.rating);
  }

  if (ratings.length === 0) return { count: 0, avgRating: null };
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return { count: ratings.length, avgRating: sum / ratings.length };
}

async function countInboundMessages(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<number> {
  const { count, error } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("direction", "inbound")
    .gte("created_at", rangeStartIso)
    .lt("created_at", rangeEndIso);

  if (error) {
    console.warn("insights messages", error.message);
    return 0;
  }
  return count ?? 0;
}

async function countNewsEngagement(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ published: number; likes: number; comments: number }> {
  const startMs = new Date(rangeStartIso).getTime();
  const endMs = new Date(rangeEndIso).getTime();

  const [gwadaRes, cacheRes] = await Promise.all([
    admin
      .from("gwada_news_posts")
      .select("id, status, published_at, created_at")
      .eq("restaurant_id", restaurantId),
    admin
      .from("restaurant_news_platform_cache")
      .select("item, published_at")
      .eq("restaurant_id", restaurantId),
  ]);

  const items: UnifiedNewsItem[] = [];

  for (const raw of gwadaRes.data ?? []) {
    const row = raw as Record<string, unknown>;
    if (row.status !== "published") continue;
    items.push({
      id: `gwada:${row.id as string}`,
      platform: "gwada",
      source: "gwada",
      postId: row.id as string,
      title: null,
      body: "",
      media: [],
      createdAt: row.created_at as string,
      publishedAt: (row.published_at as string | null) ?? null,
      scheduledAt: null,
      status: "published",
      canEdit: false,
      canDelete: false,
      externalUrl: null,
      insights: null,
      authorName: null,
    });
  }

  for (const raw of cacheRes.data ?? []) {
    const row = raw as Record<string, unknown>;
    const parsed = parseNewsCachedItem(row.item);
    if (parsed) items.push(parsed);
  }

  let published = 0;
  let likes = 0;
  let comments = 0;

  for (const item of items) {
    const iso = item.publishedAt ?? item.createdAt;
    const t = new Date(iso).getTime();
    if (t < startMs || t >= endMs) continue;
    if (item.status !== "published") continue;
    published += 1;
    likes += item.insights?.likes ?? 0;
    comments += item.insights?.comments ?? 0;
  }

  return { published, likes, comments };
}

function sumNewsEngagementForPlatform(
  items: UnifiedNewsItem[],
  platform: "facebook" | "instagram",
  rangeStartIso: string,
  rangeEndIso: string,
): { likes: number; comments: number } {
  const startMs = new Date(rangeStartIso).getTime();
  const endMs = new Date(rangeEndIso).getTime();
  let likes = 0;
  let comments = 0;
  for (const item of items) {
    if (item.platform !== platform) continue;
    const iso = item.publishedAt ?? item.createdAt;
    const t = new Date(iso).getTime();
    if (t < startMs || t >= endMs) continue;
    likes += item.insights?.likes ?? 0;
    comments += item.insights?.comments ?? 0;
  }
  return { likes, comments };
}

function topMetrics(
  metrics: Array<{ label: string; value: number }>,
  limit = 4,
): InsightsPlatformMetric[] {
  return metrics
    .filter((m) => m.value > 0)
    .slice(0, limit)
    .map((m) => ({
      label: m.label,
      value: formatInsightCount(m.value),
    }));
}

async function platformCards(
  sb: SupabaseClient,
  restaurantId: string,
  periodStartYmd: string,
  periodEndYmd: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<InsightsPlatformCard[]> {
  const flags = await fetchPlatformMessagingFlags(sb);
  const admin = createSupabaseAdminClient();

  const [{ syncRows }, newsCacheRes, platformInsights] = await Promise.all([
    readReviewsFeedFromCache(restaurantId, sb),
    admin
      ? admin
          .from("restaurant_news_platform_cache")
          .select("item")
          .eq("restaurant_id", restaurantId)
      : Promise.resolve({ data: [] as unknown[] }),
    fetchPlatformInsightsBundle({
      restaurantId,
      startYmd: periodStartYmd,
      endYmd: periodEndYmd,
      flags,
    }),
  ]);

  const newsItems = (newsCacheRes.data ?? [])
    .map((row) => parseNewsCachedItem((row as { item: unknown }).item))
    .filter((item): item is UnifiedNewsItem => item != null);

  const syncByPlatform = new Map(syncRows.map((row) => [row.platform, row]));
  const google = platformInsights.google;
  const facebook = platformInsights.facebook;
  const instagram = platformInsights.instagram;

  const googleSync = syncByPlatform.get("google");
  const googleMetrics = topMetrics([
    ...google.metrics,
    ...(googleSync?.meta.totalReviewCount != null
      ? [
          {
            key: "reviews",
            label: "Bewertungen",
            value: googleSync.meta.totalReviewCount,
          },
        ]
      : []),
  ]);
  if (
    googleSync?.meta.averageRating != null &&
    googleMetrics.length < 4 &&
    !googleMetrics.some((m) => m.label === "Ø Sterne")
  ) {
    googleMetrics.push({
      label: "Ø Sterne",
      value: formatReviewRating(googleSync.meta.averageRating),
    });
  }

  const fbNews = sumNewsEngagementForPlatform(
    newsItems,
    "facebook",
    rangeStartIso,
    rangeEndIso,
  );
  const facebookMetrics = topMetrics([
    ...facebook.metrics,
    ...(fbNews.likes > 0
      ? [{ key: "likes", label: "Likes (Beiträge)", value: fbNews.likes }]
      : []),
    ...(fbNews.comments > 0
      ? [
          {
            key: "comments",
            label: "Kommentare (Beiträge)",
            value: fbNews.comments,
          },
        ]
      : []),
  ]);

  const igNews = sumNewsEngagementForPlatform(
    newsItems,
    "instagram",
    rangeStartIso,
    rangeEndIso,
  );
  const instagramMetrics = topMetrics([
    ...instagram.metrics,
    ...(igNews.likes > 0
      ? [{ key: "likes", label: "Likes (Beiträge)", value: igNews.likes }]
      : []),
    ...(igNews.comments > 0
      ? [
          {
            key: "comments",
            label: "Kommentare (Beiträge)",
            value: igNews.comments,
          },
        ]
      : []),
  ]);

  const tripadvisorRow = flags.tripadvisorEnabled
    ? await fetchRestaurantTripadvisorConfigAdmin(restaurantId)
    : null;
  const tripadvisorConnected = tripadvisorRow?.status === "working";
  const tripSync = syncByPlatform.get("tripadvisor");
  const tripadvisorMetrics: InsightsPlatformMetric[] = [];
  if (tripSync?.meta.totalReviewCount != null) {
    tripadvisorMetrics.push({
      label: "Bewertungen gesamt",
      value: formatInsightCount(tripSync.meta.totalReviewCount),
    });
  }
  if (tripSync?.meta.averageRating != null) {
    tripadvisorMetrics.push({
      label: "Ø Sterne",
      value: formatReviewRating(tripSync.meta.averageRating),
    });
  }

  const appleRow = flags.appleBusinessConnectEnabled
    ? await fetchRestaurantAppleBusinessConnectConfigAdmin(restaurantId)
    : null;
  const appleConnected = appleRow?.status === "working";
  const appleMetrics: InsightsPlatformMetric[] = [];
  if (appleRow?.config.location_name?.trim()) {
    appleMetrics.push({
      label: "Standort",
      value: appleRow.config.location_name.trim(),
    });
  }

  return [
    {
      id: "google_business" as const,
      label: "Google Business",
      enabled: flags.googleBusinessEnabled,
      connected: google.connected,
      insightsAvailable: google.available || googleMetrics.length > 0,
      metrics: googleMetrics,
      hint: !google.connected
        ? "Unter Einstellungen → Integrationen verbinden."
        : google.error
          ? `Google Performance: ${google.error}`
          : google.available
            ? "Profil-Aufrufe und Klicks aus Google Business Performance."
            : "Verbunden — Performance-Daten folgen, sobald Google Werte liefert.",
    },
    {
      id: "facebook" as const,
      label: "Facebook",
      enabled: flags.facebookEnabled,
      connected: facebook.connected,
      insightsAvailable: facebook.available || facebookMetrics.length > 0,
      metrics: facebookMetrics,
      hint: !facebook.connected
        ? "Facebook-Seite unter Integrationen verbinden."
        : facebook.needsReconnect
          ? "Bitte Facebook erneut verbinden (Scope „Seiten-Statistiken“)."
          : facebook.available
            ? "Seiten-Impressionen und Reichweite aus Meta Page Insights."
            : facebook.error
              ? `Facebook Insights: ${facebook.error}`
              : "Verbunden — Seiten-Insights erscheinen nach Sync / Freigabe.",
    },
    {
      id: "instagram" as const,
      label: "Instagram",
      enabled: flags.instagramEnabled,
      connected: instagram.connected,
      insightsAvailable: instagram.available || instagramMetrics.length > 0,
      metrics: instagramMetrics,
      hint: !instagram.connected
        ? "Instagram Business unter Integrationen verbinden."
        : instagram.available
          ? "Reichweite und Views aus Instagram Account Insights (max. ~30 Tage)."
          : instagram.error
            ? `Instagram Insights: ${instagram.error}`
            : "Verbunden — Account-Insights erscheinen nach Sync / Freigabe.",
    },
    {
      id: "tripadvisor" as const,
      label: "TripAdvisor",
      enabled: flags.tripadvisorEnabled,
      connected: tripadvisorConnected,
      insightsAvailable: tripadvisorMetrics.length > 0,
      metrics: tripadvisorMetrics,
      hint: tripadvisorConnected
        ? tripadvisorMetrics.length > 0
          ? "Bewertungen und Galerie aktiv — Terra-Sync wöchentlich."
          : "Verbunden — Bewertungen werden beim nächsten Sync geladen."
        : "TripAdvisor Location-ID unter Integrationen hinterlegen.",
    },
    {
      id: "apple_business_connect" as const,
      label: "Apple Business Connect",
      enabled: flags.appleBusinessConnectEnabled,
      connected: appleConnected,
      insightsAvailable: appleConnected,
      metrics: appleMetrics,
      hint: appleConnected
        ? "Standort verknüpft — Apple-Profil-Metriken folgen mit API-Anbindung."
        : "Apple Business Connect unter Integrationen einrichten.",
    },
  ].filter((card) => card.enabled);
}

export async function fetchInsightsOverview(
  sb: SupabaseClient,
  restaurantId: string,
  rangeParams: InsightsFetchRangeParams,
): Promise<InsightsOverviewPayload | { error: string }> {
  const range = resolveInsightsRange(rangeParams);
  if (!range) return { error: "invalid_date_range" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };

  const { rangeStartIso, rangeEndIso, periodStartYmd, periodEndYmd } = range;
  const periodDays =
    "periodDays" in rangeParams ? rangeParams.periodDays : null;

  const [reservations, reviews, messages, news, platforms] = await Promise.all([
    countReservations(admin, restaurantId, rangeStartIso, rangeEndIso),
    countAllReviews(admin, sb, restaurantId, rangeStartIso, rangeEndIso),
    countInboundMessages(admin, restaurantId, rangeStartIso, rangeEndIso),
    countNewsEngagement(admin, restaurantId, rangeStartIso, rangeEndIso),
    platformCards(
      sb,
      restaurantId,
      periodStartYmd,
      periodEndYmd,
      rangeStartIso,
      rangeEndIso,
    ),
  ]);

  return {
    periodMode: periodDays != null ? "preset" : "custom",
    periodDays,
    periodStartYmd,
    periodEndYmd,
    periodStart: rangeStartIso,
    periodEnd: rangeEndIso,
    gwada: {
      reservations,
      reviews,
      messages: { inbound: messages },
      news,
    },
    platforms,
  };
}
