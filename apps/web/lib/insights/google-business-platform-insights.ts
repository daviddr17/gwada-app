import "server-only";

import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";
import {
  emptyGoogleInsights,
  formatDayLabel,
  type GoogleBusinessPlatformInsights,
  type PlatformInsightDayPoint,
  type PlatformInsightSeries,
} from "@/lib/insights/platform-insights-types";

const GOOGLE_DAILY_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
] as const;

type GoogleDailyMetric = (typeof GOOGLE_DAILY_METRICS)[number];

type GoogleDatedValue = {
  date?: { year?: number; month?: number; day?: number };
  value?: string | number;
};

type GoogleTimeSeriesPayload = {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: string;
      timeSeries?: { datedValues?: GoogleDatedValue[] };
    }>;
  }>;
  error?: { message?: string; status?: string };
};

function locationResourceName(locationName: string): string | null {
  const trimmed = locationName.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("locations/")) {
    return trimmed.split("/").slice(0, 2).join("/");
  }
  const match = /locations\/[^/]+/.exec(trimmed);
  return match?.[0] ?? null;
}

function ymdFromGoogleDate(date?: {
  year?: number;
  month?: number;
  day?: number;
}): string | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function sumDatedValues(values: GoogleDatedValue[] | undefined): number {
  if (!values?.length) return 0;
  return values.reduce((sum, entry) => {
    const raw = entry.value;
    const n = typeof raw === "number" ? raw : Number(raw ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function seriesFromDatedValues(
  key: string,
  label: string,
  values: GoogleDatedValue[] | undefined,
): PlatformInsightSeries {
  const byDay: PlatformInsightDayPoint[] = [];
  for (const entry of values ?? []) {
    const date = ymdFromGoogleDate(entry.date);
    if (!date) continue;
    const raw = entry.value;
    const n = typeof raw === "number" ? raw : Number(raw ?? 0);
    byDay.push({
      date,
      label: formatDayLabel(date),
      value: Number.isFinite(n) ? n : 0,
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

function mergeSeries(
  key: string,
  label: string,
  parts: PlatformInsightSeries[],
): PlatformInsightSeries {
  const byDate = new Map<string, number>();
  for (const part of parts) {
    for (const point of part.byDay) {
      byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.value);
    }
  }
  const byDay = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      label: formatDayLabel(date),
      value,
    }));
  return {
    key,
    label,
    total: byDay.reduce((sum, row) => sum + row.value, 0),
    byDay,
  };
}

function parseYmdParts(ymd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export async function fetchGoogleBusinessPlatformInsights(params: {
  restaurantId: string;
  startYmd: string;
  endYmd: string;
}): Promise<GoogleBusinessPlatformInsights> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(params.restaurantId);
  if ("error" in auth) {
    return emptyGoogleInsights({
      connected: false,
      error: auth.error,
    });
  }

  const location = locationResourceName(auth.config.location_name ?? "");
  if (!location) {
    return emptyGoogleInsights({
      connected: true,
      error: "google_location_missing",
    });
  }

  const start = parseYmdParts(params.startYmd);
  const end = parseYmdParts(params.endYmd);
  if (!start || !end) {
    return emptyGoogleInsights({
      connected: true,
      error: "invalid_date_range",
    });
  }

  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/${location}:fetchMultiDailyMetricsTimeSeries`,
  );
  for (const metric of GOOGLE_DAILY_METRICS) {
    url.searchParams.append("dailyMetrics", metric);
  }
  url.searchParams.set("dailyRange.start_date.year", String(start.year));
  url.searchParams.set("dailyRange.start_date.month", String(start.month));
  url.searchParams.set("dailyRange.start_date.day", String(start.day));
  url.searchParams.set("dailyRange.end_date.year", String(end.year));
  url.searchParams.set("dailyRange.end_date.month", String(end.month));
  url.searchParams.set("dailyRange.end_date.day", String(end.day));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as GoogleTimeSeriesPayload;
  if (!res.ok) {
    return emptyGoogleInsights({
      connected: true,
      error: body.error?.message ?? `google_performance_${res.status}`,
    });
  }

  const byMetric = new Map<string, GoogleDatedValue[]>();
  for (const multi of body.multiDailyMetricTimeSeries ?? []) {
    for (const entry of multi.dailyMetricTimeSeries ?? []) {
      const key = entry.dailyMetric?.trim();
      if (!key) continue;
      byMetric.set(key, entry.timeSeries?.datedValues ?? []);
    }
  }

  const desktopMaps = seriesFromDatedValues(
    "desktop_maps",
    "Maps Desktop",
    byMetric.get("BUSINESS_IMPRESSIONS_DESKTOP_MAPS"),
  );
  const mobileMaps = seriesFromDatedValues(
    "mobile_maps",
    "Maps Mobile",
    byMetric.get("BUSINESS_IMPRESSIONS_MOBILE_MAPS"),
  );
  const desktopSearch = seriesFromDatedValues(
    "desktop_search",
    "Suche Desktop",
    byMetric.get("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"),
  );
  const mobileSearch = seriesFromDatedValues(
    "mobile_search",
    "Suche Mobile",
    byMetric.get("BUSINESS_IMPRESSIONS_MOBILE_SEARCH"),
  );
  const websiteClicksSeries = seriesFromDatedValues(
    "website_clicks",
    "Website-Klicks",
    byMetric.get("WEBSITE_CLICKS"),
  );
  const callClicksSeries = seriesFromDatedValues(
    "call_clicks",
    "Anrufe",
    byMetric.get("CALL_CLICKS"),
  );
  const directionsSeries = seriesFromDatedValues(
    "direction_requests",
    "Wegbeschreibungen",
    byMetric.get("BUSINESS_DIRECTION_REQUESTS"),
  );

  const mapsImpressionsSeries = mergeSeries("maps", "Maps-Aufrufe", [
    desktopMaps,
    mobileMaps,
  ]);
  const searchImpressionsSeries = mergeSeries("search", "Suchaufrufe", [
    desktopSearch,
    mobileSearch,
  ]);
  const impressionsSeries = mergeSeries("impressions", "Aufrufe gesamt", [
    mapsImpressionsSeries,
    searchImpressionsSeries,
  ]);
  const clicksSeries = mergeSeries("clicks", "Klicks", [
    websiteClicksSeries,
    callClicksSeries,
    directionsSeries,
  ]);

  const impressions = impressionsSeries.total;
  const searchImpressions = searchImpressionsSeries.total;
  const mapsImpressions = mapsImpressionsSeries.total;
  const websiteClicks = websiteClicksSeries.total;
  const callClicks = callClicksSeries.total;
  const directionRequests = directionsSeries.total;

  const metrics = [
    { key: "impressions", label: "Aufrufe", value: impressions },
    { key: "search", label: "Suche", value: searchImpressions },
    { key: "maps", label: "Maps", value: mapsImpressions },
    { key: "website", label: "Website-Klicks", value: websiteClicks },
    { key: "calls", label: "Anrufe", value: callClicks },
    { key: "directions", label: "Routen", value: directionRequests },
  ].filter((m) => m.value > 0);

  return {
    platform: "google_business",
    connected: true,
    available: metrics.length > 0 || impressionsSeries.byDay.length > 0,
    error: null,
    metrics,
    series: [impressionsSeries, clicksSeries, searchImpressionsSeries, mapsImpressionsSeries],
    impressions,
    searchImpressions,
    mapsImpressions,
    websiteClicks,
    callClicks,
    directionRequests,
  };
}

/** nur für Typ-Check / Debugging */
export type { GoogleDailyMetric };
