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
};

const FACEBOOK_DAY_METRICS = [
  "page_impressions",
  "page_impressions_unique",
  "page_post_engagements",
  "page_views_total",
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
  const date = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  return Math.floor(date.getTime() / 1000);
}

function looksLikeMissingInsightsScope(error: string): boolean {
  return /read_insights|#10|#200|permission|권한|scope/i.test(error);
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
  const needsReconnect =
    granted.length > 0 && !granted.includes("read_insights");

  const since = unixSeconds(params.startYmd);
  const until = unixSeconds(params.endYmd, true);

  const dayParams = new URLSearchParams({
    access_token: token,
    metric: FACEBOOK_DAY_METRICS.join(","),
    period: "day",
    since: String(since),
    until: String(until),
  });

  const dayResult = await metaGraphGet<MetaInsightsResponse>(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/insights?${dayParams}`,
    { platform: "facebook", feature: "insights" },
  );

  if (dayResult.error) {
    return emptyFacebookInsights({
      connected: true,
      needsReconnect: needsReconnect || looksLikeMissingInsightsScope(dayResult.error),
      error: dayResult.error,
    });
  }

  const rows = dayResult.data?.data ?? [];
  const byName = new Map(rows.map((row) => [row.name ?? "", row]));

  const impressionsSeries = seriesFromMetaValues(
    "impressions",
    "Impressionen",
    byName.get("page_impressions")?.values,
  );
  const reachSeries = seriesFromMetaValues(
    "reach",
    "Reichweite",
    byName.get("page_impressions_unique")?.values,
  );
  const engagementSeries = seriesFromMetaValues(
    "engagements",
    "Beitrags-Interaktionen",
    byName.get("page_post_engagements")?.values,
  );
  const viewsSeries = seriesFromMetaValues(
    "page_views",
    "Seitenaufrufe",
    byName.get("page_views_total")?.values,
  );

  let fans: number | null = null;
  const fansParams = new URLSearchParams({
    access_token: token,
    metric: "page_fans",
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
    { key: "impressions", label: "Impressionen", value: impressionsSeries.total },
    { key: "reach", label: "Reichweite", value: reachSeries.total },
    { key: "engagements", label: "Interaktionen", value: engagementSeries.total },
    { key: "views", label: "Seitenaufrufe", value: viewsSeries.total },
    ...(fans != null ? [{ key: "fans", label: "Fans", value: fans }] : []),
  ].filter((m) => m.value > 0);

  return {
    platform: "facebook",
    connected: true,
    available: metrics.length > 0,
    error: null,
    metrics,
    series: [impressionsSeries, reachSeries, engagementSeries, viewsSeries],
    impressions: impressionsSeries.total,
    reach: reachSeries.total,
    postEngagements: engagementSeries.total,
    pageViews: viewsSeries.total,
    fans,
    needsReconnect,
  };
}
