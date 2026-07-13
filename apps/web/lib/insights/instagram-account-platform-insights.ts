import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { metaGraphGet } from "@/lib/contact-messages/meta-graph-client";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import {
  emptyInstagramInsights,
  formatDayLabel,
  type InstagramAccountPlatformInsights,
  type PlatformInsightDayPoint,
  type PlatformInsightSeries,
  ymdFromIso,
} from "@/lib/insights/platform-insights-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

type MetaInsightValue = {
  value?: number;
  end_time?: string;
};

type MetaInsightBreakdownResult = {
  dimension_values?: string[];
  value?: number;
};

type MetaInsightRow = {
  name?: string;
  period?: string;
  values?: MetaInsightValue[];
  total_value?: {
    value?: number;
    breakdowns?: Array<{
      dimension_keys?: string[];
      results?: MetaInsightBreakdownResult[];
    }>;
  };
};

type MetaInsightsResponse = {
  data?: MetaInsightRow[];
};

const IG_TIME_SERIES_METRICS = ["reach"] as const;

/** Interaction totals (metric_type=total_value). views nur als total_value (kein time_series). */
const IG_TOTAL_VALUE_METRICS = [
  "views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "profile_links_taps",
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

/** Meta liefert Account-Insights meist nur ~30 Tage rückwirkend. */
function clampMetaInsightsStart(startYmd: string, endYmd: string): string {
  const end = new Date(`${endYmd}T12:00:00`);
  const start = new Date(`${startYmd}T12:00:00`);
  const minStart = new Date(end);
  minStart.setDate(minStart.getDate() - 28);
  const effective = start < minStart ? minStart : start;
  const y = effective.getFullYear();
  const m = String(effective.getMonth() + 1).padStart(2, "0");
  const d = String(effective.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function totalValue(row: MetaInsightRow | undefined): number {
  return Number(row?.total_value?.value ?? 0) || 0;
}

export async function fetchInstagramAccountPlatformInsights(params: {
  restaurantId: string;
  startYmd: string;
  endYmd: string;
}): Promise<InstagramAccountPlatformInsights> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    params.restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") {
    return emptyInstagramInsights({
      connected: false,
      error: "instagram_not_connected",
    });
  }

  const igId = row.config.instagram_business_account_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!igId || !token) {
    return emptyInstagramInsights({
      connected: true,
      error: "instagram_account_missing",
    });
  }

  const startYmd = clampMetaInsightsStart(params.startYmd, params.endYmd);
  const since = unixSeconds(startYmd);
  const until = unixSeconds(params.endYmd, true);

  const seriesParams = new URLSearchParams({
    access_token: token,
    metric: IG_TIME_SERIES_METRICS.join(","),
    period: "day",
    metric_type: "time_series",
    since: String(since),
    until: String(until),
  });

  const seriesResult = await metaGraphGet<MetaInsightsResponse>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igId}/insights?${seriesParams}`,
    { platform: "instagram", feature: "insights" },
  );

  const seriesData =
    seriesResult.error == null
      ? seriesResult.data
      : (
          await metaGraphGet<MetaInsightsResponse>(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/${igId}/insights?${new URLSearchParams(
              {
                access_token: token,
                metric: "reach",
                period: "day",
                since: String(since),
                until: String(until),
              },
            )}`,
            { platform: "instagram", feature: "insights" },
          )
        ).data;

  if (!seriesData && seriesResult.error) {
    return emptyInstagramInsights({
      connected: true,
      error: seriesResult.error,
    });
  }

  const byName = new Map(
    (seriesData?.data ?? []).map((row) => [row.name ?? "", row]),
  );

  const reachSeries = seriesFromMetaValues(
    "reach",
    "Reichweite",
    byName.get("reach")?.values,
  );

  let accountsEngaged = 0;
  let totalInteractions = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let saves = 0;
  let replies = 0;
  let profileLinkTaps = 0;
  let views = 0;
  let follows = 0;
  let unfollows = 0;

  const totalsParams = new URLSearchParams({
    access_token: token,
    metric: IG_TOTAL_VALUE_METRICS.join(","),
    period: "day",
    metric_type: "total_value",
    since: String(since),
    until: String(until),
  });
  const totalsResult = await metaGraphGet<MetaInsightsResponse>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igId}/insights?${totalsParams}`,
    { platform: "instagram", feature: "insights" },
  );
  if (!totalsResult.error) {
    const map = new Map(
      (totalsResult.data?.data ?? []).map((r) => [r.name ?? "", r]),
    );
    views = totalValue(map.get("views"));
    accountsEngaged = totalValue(map.get("accounts_engaged"));
    totalInteractions = totalValue(map.get("total_interactions"));
    likes = totalValue(map.get("likes"));
    comments = totalValue(map.get("comments"));
    shares = totalValue(map.get("shares"));
    saves = totalValue(map.get("saves"));
    replies = totalValue(map.get("replies"));
    profileLinkTaps = totalValue(map.get("profile_links_taps"));
  }

  const viewsSeries: PlatformInsightSeries = {
    key: "views",
    label: "Views",
    total: views,
    byDay: [],
  };

  // Follows/Unfollows mit Breakdown (oft erst ab ~100 Followern)
  const followsParams = new URLSearchParams({
    access_token: token,
    metric: "follows_and_unfollows",
    period: "day",
    metric_type: "total_value",
    breakdown: "follow_type",
    since: String(since),
    until: String(until),
  });
  const followsResult = await metaGraphGet<MetaInsightsResponse>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igId}/insights?${followsParams}`,
    { platform: "instagram", feature: "insights" },
  );
  if (!followsResult.error) {
    const row = followsResult.data?.data?.find(
      (r) => r.name === "follows_and_unfollows",
    );
    const results = row?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const r of results) {
      const dims = (r.dimension_values ?? []).map((d) => d.toUpperCase());
      const v = Number(r.value ?? 0) || 0;
      if (dims.some((d) => d.includes("UNFOLLOW"))) unfollows += v;
      else if (dims.some((d) => d.includes("FOLLOW"))) follows += v;
    }
    if (follows === 0 && unfollows === 0) {
      follows = totalValue(row);
    }
  }

  const metrics = [
    { key: "reach", label: "Reichweite", value: reachSeries.total },
    { key: "views", label: "Views", value: views },
    { key: "engaged", label: "Accounts engaged", value: accountsEngaged },
    { key: "interactions", label: "Interaktionen", value: totalInteractions },
    { key: "likes", label: "Likes", value: likes },
    { key: "comments", label: "Kommentare", value: comments },
    { key: "shares", label: "Shares", value: shares },
    { key: "saves", label: "Saves", value: saves },
    { key: "replies", label: "Story-Antworten", value: replies },
    { key: "profile_taps", label: "Profil-Link-Taps", value: profileLinkTaps },
    { key: "follows", label: "Follower +", value: follows },
    { key: "unfollows", label: "Entfolger", value: unfollows },
  ];

  return {
    platform: "instagram",
    connected: true,
    available:
      metrics.some((m) => m.value > 0) ||
      reachSeries.byDay.length > 0,
    error: null,
    metrics,
    series: [reachSeries, viewsSeries],
    reach: reachSeries.total,
    views,
    accountsEngaged,
    totalInteractions,
    likes,
    comments,
    shares,
    saves,
    replies,
    profileLinkTaps,
    follows,
    unfollows,
  };
}
