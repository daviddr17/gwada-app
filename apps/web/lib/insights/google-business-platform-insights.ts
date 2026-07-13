import "server-only";

import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";
import {
  emptyGoogleInsights,
  formatDayLabel,
  type GoogleBusinessPlatformInsights,
  type PlatformInsightDayPoint,
  type PlatformInsightMetric,
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
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_BOOKINGS",
  "BUSINESS_FOOD_MENU_CLICKS",
] as const;

type GoogleDatedValue = {
  date?: { year?: number; month?: number; day?: number };
  value?: string | number;
};

type GoogleMetricSeriesEntry = {
  dailyMetric?: string;
  daily_metric?: string;
  timeSeries?: { datedValues?: GoogleDatedValue[] };
  time_series?: { dated_values?: GoogleDatedValue[] };
};

type GoogleTimeSeriesPayload = {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: GoogleMetricSeriesEntry[];
    daily_metric_time_series?: GoogleMetricSeriesEntry[];
  }>;
  multi_daily_metric_time_series?: Array<{
    dailyMetricTimeSeries?: GoogleMetricSeriesEntry[];
    daily_metric_time_series?: GoogleMetricSeriesEntry[];
  }>;
  error?: { message?: string; status?: string; code?: number };
};

/** Performance-Daten oft 2–3 Tage verzögert. */
const GOOGLE_PERFORMANCE_LAG_DAYS = 3;

function locationResourceName(locationName: string): string | null {
  const trimmed = locationName.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("locations/")) {
    return trimmed.split("/").slice(0, 2).join("/");
  }
  const match = /locations\/[^/]+/.exec(trimmed);
  if (match?.[0]) return match[0];
  if (/^\d+$/.test(trimmed)) return `locations/${trimmed}`;
  return null;
}

function ymdFromGoogleDate(date?: {
  year?: number;
  month?: number;
  day?: number;
}): string | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
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

function ymdAddDays(ymd: string, deltaDays: number): string {
  const parts = parseYmdParts(ymd);
  if (!parts) return ymd;
  const d = new Date(parts.year, parts.month - 1, parts.day);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clampGooglePerformanceRange(startYmd: string, endYmd: string): {
  startYmd: string;
  endYmd: string;
} | null {
  const latest = ymdAddDays(todayYmd(), -GOOGLE_PERFORMANCE_LAG_DAYS);
  const end = endYmd > latest ? latest : endYmd;
  let start = startYmd;
  if (start > end) {
    start = ymdAddDays(end, -30);
  }
  if (start > end) return null;
  return { startYmd: start, endYmd: end };
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

function collectMetricSeries(
  body: GoogleTimeSeriesPayload,
): Map<string, GoogleDatedValue[]> {
  const byMetric = new Map<string, GoogleDatedValue[]>();
  const multis =
    body.multiDailyMetricTimeSeries ?? body.multi_daily_metric_time_series ?? [];
  for (const multi of multis) {
    const entries =
      multi.dailyMetricTimeSeries ?? multi.daily_metric_time_series ?? [];
    for (const entry of entries) {
      const key = (entry.dailyMetric ?? entry.daily_metric)?.trim();
      if (!key) continue;
      const values =
        entry.timeSeries?.datedValues ?? entry.time_series?.dated_values ?? [];
      byMetric.set(key, values);
    }
  }
  return byMetric;
}

function buildPerformanceUrl(
  location: string,
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number },
  style: "camel" | "snake",
): URL {
  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/${location}:fetchMultiDailyMetricsTimeSeries`,
  );
  for (const metric of GOOGLE_DAILY_METRICS) {
    url.searchParams.append("dailyMetrics", metric);
  }
  if (style === "camel") {
    url.searchParams.set("dailyRange.start_date.year", String(start.year));
    url.searchParams.set("dailyRange.start_date.month", String(start.month));
    url.searchParams.set("dailyRange.start_date.day", String(start.day));
    url.searchParams.set("dailyRange.end_date.year", String(end.year));
    url.searchParams.set("dailyRange.end_date.month", String(end.month));
    url.searchParams.set("dailyRange.end_date.day", String(end.day));
  } else {
    url.searchParams.set("daily_range.start_date.year", String(start.year));
    url.searchParams.set("daily_range.start_date.month", String(start.month));
    url.searchParams.set("daily_range.start_date.day", String(start.day));
    url.searchParams.set("daily_range.end_date.year", String(end.year));
    url.searchParams.set("daily_range.end_date.month", String(end.month));
    url.searchParams.set("daily_range.end_date.day", String(end.day));
  }
  return url;
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

  const clamped = clampGooglePerformanceRange(params.startYmd, params.endYmd);
  if (!clamped) {
    return emptyGoogleInsights({
      connected: true,
      error: "google_performance_range_empty",
    });
  }

  const start = parseYmdParts(clamped.startYmd);
  const end = parseYmdParts(clamped.endYmd);
  if (!start || !end) {
    return emptyGoogleInsights({
      connected: true,
      error: "invalid_date_range",
    });
  }

  let body: GoogleTimeSeriesPayload = {};
  let lastError: string | null = null;

  for (const style of ["camel", "snake"] as const) {
    const url = buildPerformanceUrl(location, start, end, style);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    body = (await res.json().catch(() => ({}))) as GoogleTimeSeriesPayload;
    if (res.ok) {
      lastError = null;
      break;
    }
    lastError = body.error?.message ?? `google_performance_${res.status}`;
  }

  if (lastError) {
    return emptyGoogleInsights({
      connected: true,
      error: lastError,
    });
  }

  const byMetric = collectMetricSeries(body);

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
  const conversationsSeries = seriesFromDatedValues(
    "conversations",
    "Nachrichten",
    byMetric.get("BUSINESS_CONVERSATIONS"),
  );
  const bookingsSeries = seriesFromDatedValues(
    "bookings",
    "Buchungen",
    byMetric.get("BUSINESS_BOOKINGS"),
  );
  const menuClicksSeries = seriesFromDatedValues(
    "menu_clicks",
    "Menü-Klicks",
    byMetric.get("BUSINESS_FOOD_MENU_CLICKS"),
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
  const interactionsSeries = mergeSeries("interactions", "Interaktionen", [
    websiteClicksSeries,
    callClicksSeries,
    directionsSeries,
    conversationsSeries,
    bookingsSeries,
    menuClicksSeries,
  ]);

  const impressions = impressionsSeries.total;
  const searchImpressions = searchImpressionsSeries.total;
  const mapsImpressions = mapsImpressionsSeries.total;
  const websiteClicks = websiteClicksSeries.total;
  const callClicks = callClicksSeries.total;
  const directionRequests = directionsSeries.total;
  const conversations = conversationsSeries.total;
  const bookings = bookingsSeries.total;
  const menuClicks = menuClicksSeries.total;
  const interactions = interactionsSeries.total;

  // Immer alle Kernmetriken zeigen — auch mit 0 — damit klar ist, was gemessen wird.
  const metrics: PlatformInsightMetric[] = [
    { key: "impressions", label: "Aufrufe", value: impressions },
    { key: "search", label: "Suche", value: searchImpressions },
    { key: "maps", label: "Maps", value: mapsImpressions },
    { key: "interactions", label: "Interaktionen", value: interactions },
    { key: "calls", label: "Anrufe", value: callClicks },
    { key: "website", label: "Website", value: websiteClicks },
    { key: "directions", label: "Routen", value: directionRequests },
    { key: "conversations", label: "Nachrichten", value: conversations },
    { key: "bookings", label: "Buchungen", value: bookings },
    { key: "menu", label: "Menü", value: menuClicks },
  ];

  const hasAnySeries =
    impressionsSeries.byDay.length > 0 || interactionsSeries.byDay.length > 0;

  return {
    platform: "google_business",
    connected: true,
    available: hasAnySeries || metrics.some((m) => m.value > 0),
    error: null,
    metrics,
    series: [
      impressionsSeries,
      interactionsSeries,
      searchImpressionsSeries,
      mapsImpressionsSeries,
      callClicksSeries,
      websiteClicksSeries,
      directionsSeries,
    ],
    impressions,
    searchImpressions,
    mapsImpressions,
    websiteClicks,
    callClicks,
    directionRequests,
    conversations,
    bookings,
    menuClicks,
    interactions,
  };
}
