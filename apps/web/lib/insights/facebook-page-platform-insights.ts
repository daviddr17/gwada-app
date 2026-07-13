import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { metaGraphGet } from "@/lib/contact-messages/meta-graph-client";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import {
  emptyFacebookInsights,
  formatDayLabel,
  type FacebookPagePlatformInsights,
  type PlatformInsightDayPoint,
  type PlatformInsightSeries,
  ymdFromIso,
} from "@/lib/insights/platform-insights-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

type MetaInsightValue = {
  value?: number;
  end_time?: string;
};

type MetaInsightRow = {
  name?: string;
  period?: string;
  values?: MetaInsightValue[];
  total_value?: { value?: number };
};

type MetaInsightsResponse = {
  data?: MetaInsightRow[];
  error?: { message?: string; code?: number };
};

/**
 * Page Insights nach Meta-Deprecations (Impressionen/Fans).
 * Zusätzlich: Follower-Zu-/Abgänge, CTA-Klicks, Video-Views.
 */
const FACEBOOK_DAY_METRICS = [
  "page_media_view",
  "page_total_media_view_unique",
  "page_post_engagements",
  "page_views_total",
  "page_daily_follows_unique",
  "page_daily_unfollows_unique",
  "page_total_actions",
  "page_video_views",
] as const;

function seriesFromMetaValues(
  key: string,
  label: string,
  values: MetaInsightValue[] | undefined,
): PlatformInsightSeries {
  const byDay: PlatformInsightDayPoint[] = [];
  for (const entry of values ?? []) {
    if (!entry.end_time) continue;
    const date = ymdFromIso(entry.end_time);
    byDay.push({
      date,
      label: formatDayLabel(date),
      value: Number(entry.value ?? 0) || 0,
    });
  }
  byDay.sort((a, b) => a.date.localeCompare(b.date));
  return {
    key,
    label,
    total: byDay.reduce((sum, row) => sum + row.value, 0),
    byDay,
  };
}

function unixSeconds(ymd: string, endOfDay = false): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(
    y,
    m - 1,
    d,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
  );
  return Math.floor(date.getTime() / 1000);
}

function isPermissionError(message: string): boolean {
  return /(permission|oauth|access|(#10)|(#200)|read_insights)/i.test(message);
}

function isInvalidMetricError(message: string): boolean {
  return /(invalid metric)|(unknown metric)|(does not exist|unsupported metric)/i.test(
    message,
  );
}

async function fetchInsightsBundle(params: {
  pageId: string;
  token: string;
  metrics: readonly string[];
  since: number;
  until: number;
}): Promise<{ rows: MetaInsightRow[]; error: string | null }> {
  const qs = new URLSearchParams({
    access_token: params.token,
    metric: params.metrics.join(","),
    period: "day",
    since: String(params.since),
    until: String(params.until),
  });
  const result = await metaGraphGet<MetaInsightsResponse>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${params.pageId}/insights?${qs}`,
    { platform: "facebook", feature: "insights" },
  );
  if (result.error) return { rows: [], error: result.error };
  return { rows: result.data?.data ?? [], error: null };
}

async function fetchInsightsIndividually(params: {
  pageId: string;
  token: string;
  metrics: readonly string[];
  since: number;
  until: number;
}): Promise<{ rows: MetaInsightRow[]; errors: string[] }> {
  const rows: MetaInsightRow[] = [];
  const errors: string[] = [];
  for (const metric of params.metrics) {
    const batch = await fetchInsightsBundle({
      pageId: params.pageId,
      token: params.token,
      metrics: [metric],
      since: params.since,
      until: params.until,
    });
    if (batch.error) {
      if (!isInvalidMetricError(batch.error)) errors.push(batch.error);
      continue;
    }
    rows.push(...batch.rows);
  }
  return { rows, errors };
}

export async function fetchFacebookPagePlatformInsights(params: {
  restaurantId: string;
  startYmd: string;
  endYmd: string;
}): Promise<FacebookPagePlatformInsights> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    params.restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") {
    return emptyFacebookInsights({ connected: false, error: "facebook_not_connected" });
  }

  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) {
    return emptyFacebookInsights({
      connected: true,
      error: "facebook_token_missing",
    });
  }

  const granted = row.config.granted_scopes ?? [];
  const hasReadInsights =
    granted.length === 0 || granted.includes("read_insights");

  const since = unixSeconds(params.startYmd);
  const until = unixSeconds(params.endYmd, true);

  let rows: MetaInsightRow[] = [];
  let fetchError: string | null = null;

  const batch = await fetchInsightsBundle({
    pageId,
    token,
    metrics: FACEBOOK_DAY_METRICS,
    since,
    until,
  });

  if (!batch.error) {
    rows = batch.rows;
  } else if (isInvalidMetricError(batch.error)) {
    const individual = await fetchInsightsIndividually({
      pageId,
      token,
      metrics: FACEBOOK_DAY_METRICS,
      since,
      until,
    });
    rows = individual.rows;
    fetchError = individual.errors[0] ?? null;
  } else {
    fetchError = batch.error;
  }

  if (fetchError && rows.length === 0) {
    const permissionBlocked = isPermissionError(fetchError);
    const needsAppReview = permissionBlocked && !hasReadInsights;
    return emptyFacebookInsights({
      connected: true,
      needsReconnect: false,
      error: needsAppReview
        ? "facebook_insights_app_review"
        : fetchError,
    });
  }

  const byName = new Map(rows.map((entry) => [entry.name ?? "", entry]));

  const viewsSeries = seriesFromMetaValues(
    "media_views",
    "Media-Views",
    byName.get("page_media_view")?.values,
  );
  const reachSeries = seriesFromMetaValues(
    "reach",
    "Reichweite",
    byName.get("page_total_media_view_unique")?.values,
  );
  const engagementSeries = seriesFromMetaValues(
    "engagements",
    "Beitrags-Interaktionen",
    byName.get("page_post_engagements")?.values,
  );
  const pageViewsSeries = seriesFromMetaValues(
    "page_views",
    "Seitenaufrufe",
    byName.get("page_views_total")?.values,
  );
  const followsUniqueSeries = seriesFromMetaValues(
    "follows_unique",
    "Neue Follower",
    byName.get("page_daily_follows_unique")?.values,
  );
  const unfollowsUniqueSeries = seriesFromMetaValues(
    "unfollows_unique",
    "Entfolger",
    byName.get("page_daily_unfollows_unique")?.values,
  );
  const ctaSeries = seriesFromMetaValues(
    "cta_clicks",
    "CTA / Kontakt-Klicks",
    byName.get("page_total_actions")?.values,
  );
  const videoSeries = seriesFromMetaValues(
    "video_views",
    "Video-Views",
    byName.get("page_video_views")?.values,
  );

  let fans: number | null = null;
  const fansParams = new URLSearchParams({
    access_token: token,
    metric: "page_follows",
    period: "day",
  });
  const fansResult = await metaGraphGet<MetaInsightsResponse>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/insights?${fansParams}`,
    { platform: "facebook", feature: "insights" },
  );
  if (!fansResult.error) {
    const fanValues = fansResult.data?.data?.[0]?.values;
    if (fanValues?.length) {
      fans = Number(fanValues[fanValues.length - 1]?.value ?? NaN);
      if (!Number.isFinite(fans)) fans = null;
    }
  }

  const metrics = [
    { key: "reach", label: "Reichweite", value: reachSeries.total },
    { key: "views", label: "Media-Views", value: viewsSeries.total },
    { key: "engagements", label: "Interaktionen", value: engagementSeries.total },
    { key: "page_views", label: "Seitenaufrufe", value: pageViewsSeries.total },
    { key: "follows_unique", label: "Neue Follower", value: followsUniqueSeries.total },
    { key: "unfollows_unique", label: "Entfolger", value: unfollowsUniqueSeries.total },
    { key: "cta", label: "CTA-Klicks", value: ctaSeries.total },
    { key: "video", label: "Video-Views", value: videoSeries.total },
    ...(fans != null ? [{ key: "follows", label: "Follower gesamt", value: fans }] : []),
  ];

  return {
    platform: "facebook",
    connected: true,
    available: metrics.some((m) => m.value > 0) || seriesHasDays([
      reachSeries,
      viewsSeries,
      engagementSeries,
      pageViewsSeries,
    ]),
    error: metrics.every((m) => m.value === 0) ? fetchError : null,
    metrics,
    series: [
      reachSeries,
      viewsSeries,
      engagementSeries,
      pageViewsSeries,
      followsUniqueSeries,
      unfollowsUniqueSeries,
      ctaSeries,
      videoSeries,
    ],
    impressions: viewsSeries.total,
    reach: reachSeries.total,
    postEngagements: engagementSeries.total,
    pageViews: pageViewsSeries.total,
    fans,
    followsUnique: followsUniqueSeries.total,
    unfollowsUnique: unfollowsUniqueSeries.total,
    ctaClicks: ctaSeries.total,
    videoViews: videoSeries.total,
    needsReconnect: false,
  };
}

function seriesHasDays(series: PlatformInsightSeries[]): boolean {
  return series.some((s) => s.byDay.length > 0);
}
