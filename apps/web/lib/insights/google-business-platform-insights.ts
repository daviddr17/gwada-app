import "server-only";

import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";
import {
  GOOGLE_INSIGHTS_QUOTA_NO_CACHE_MESSAGE,
  clearGoogleInsightsQuotaCooldown,
  isGoogleInsightsQuotaCooldown,
  isGoogleQuotaErrorMessage,
  markGoogleInsightsQuotaExceeded,
  readPlatformInsightsCache,
  readStalePlatformInsightsCacheForRestaurant,
  writePlatformInsightsCache,
} from "@/lib/insights/platform-insights-response-cache";
import {
  emptyGoogleInsights,
  formatDayLabel,
  type GoogleBusinessPlatformInsights,
  type GoogleSearchKeywordInsight,
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
  "BUSINESS_FOOD_ORDERS",
  "BUSINESS_FOOD_MENU_CLICKS",
] as const;

/** Performance-Daten oft 2–3 Tage verzögert. */
const GOOGLE_PERFORMANCE_LAG_DAYS = 3;

/** Tägliche Metriken sinnvoll max. ~90 Tage (Overview Default / Stats-Clamping). */
const GOOGLE_PERFORMANCE_MAX_DAYS = 90;

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
  timeSeries?: { datedValues?: GoogleDatedValue[] };
  time_series?: { dated_values?: GoogleDatedValue[] };
  error?: { message?: string; status?: string; code?: number };
};

type DateParts = { year: number; month: number; day: number };

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

function parseYmdParts(ymd: string): DateParts | null {
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

function daysBetweenInclusive(startYmd: string, endYmd: string): number {
  const start = parseYmdParts(startYmd);
  const end = parseYmdParts(endYmd);
  if (!start || !end) return 0;
  const a = Date.UTC(start.year, start.month - 1, start.day);
  const b = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((b - a) / 86_400_000) + 1;
}

function clampGooglePerformanceRange(startYmd: string, endYmd: string): {
  startYmd: string;
  endYmd: string;
} | null {
  const latest = ymdAddDays(todayYmd(), -GOOGLE_PERFORMANCE_LAG_DAYS);
  let end = endYmd > latest ? latest : endYmd;
  let start = startYmd;
  if (start > end) {
    start = ymdAddDays(end, -(GOOGLE_PERFORMANCE_MAX_DAYS - 1));
  }
  if (daysBetweenInclusive(start, end) > GOOGLE_PERFORMANCE_MAX_DAYS) {
    start = ymdAddDays(end, -(GOOGLE_PERFORMANCE_MAX_DAYS - 1));
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
      const existing = byMetric.get(key) ?? [];
      byMetric.set(key, existing.concat(values));
    }
  }
  return byMetric;
}

type ParamStyle = "rest_doc" | "camel_date" | "snake";

const preferredParamStyleByRestaurant = new Map<string, ParamStyle>();

function paramStylesToTry(restaurantId: string): ParamStyle[] {
  const preferred = preferredParamStyleByRestaurant.get(restaurantId);
  if (preferred) return [preferred];
  return ["rest_doc", "camel_date", "snake"];
}

/** Tages-Cache / Fallback: Daten anzeigen ohne Quota-Warnbanner. */
function presentGoogleInsights(
  data: GoogleBusinessPlatformInsights,
): GoogleBusinessPlatformInsights {
  return { ...data, error: null };
}

function buildPerformanceUrl(
  location: string,
  start: DateParts,
  end: DateParts,
  style: ParamStyle,
): URL {
  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/${location}:fetchMultiDailyMetricsTimeSeries`,
  );
  for (const metric of GOOGLE_DAILY_METRICS) {
    url.searchParams.append("dailyMetrics", metric);
  }
  if (style === "rest_doc") {
    // Offizielles REST-Beispiel in der Google-Doku
    url.searchParams.set("dailyRange.start_date.year", String(start.year));
    url.searchParams.set("dailyRange.start_date.month", String(start.month));
    url.searchParams.set("dailyRange.start_date.day", String(start.day));
    url.searchParams.set("dailyRange.end_date.year", String(end.year));
    url.searchParams.set("dailyRange.end_date.month", String(end.month));
    url.searchParams.set("dailyRange.end_date.day", String(end.day));
  } else if (style === "camel_date") {
    // Client-Libraries (Python/Java) mappen auf startDate
    url.searchParams.set("dailyRange.startDate.year", String(start.year));
    url.searchParams.set("dailyRange.startDate.month", String(start.month));
    url.searchParams.set("dailyRange.startDate.day", String(start.day));
    url.searchParams.set("dailyRange.endDate.year", String(end.year));
    url.searchParams.set("dailyRange.endDate.month", String(end.month));
    url.searchParams.set("dailyRange.endDate.day", String(end.day));
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

function humanizeGooglePerformanceError(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("platform_not_configured") || lower.includes("google_not_connected")) {
    return lower.includes("platform_not_configured")
      ? "Google OAuth-Credentials fehlen in den Plattform-Integrationen."
      : "Google Business ist noch nicht verbunden.";
  }
  if (
    lower.includes("unauthenticated") ||
    lower.includes("invalid authentication") ||
    lower.includes("invalid_grant")
  ) {
    return "Google-Zugang abgelaufen — bitte unter Integrationen neu verbinden.";
  }
  if (
    lower.includes("insufficient") &&
    (lower.includes("scope") || lower.includes("authentication scopes"))
  ) {
    return "Fehlende Google-Berechtigung für Insights — bitte Google unter Integrationen neu verbinden.";
  }
  if (lower.includes("permission") || lower.includes("forbidden") || lower.includes("403")) {
    return "Keine Berechtigung für Google Business Performance — Konto neu verbinden.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "Google-Standort nicht gefunden — Standort in Integrationen prüfen.";
  }
  // Nur echte „API disabled“-Signale — nicht jeder String mit dem API-Namen.
  if (
    lower.includes("has not been used") ||
    lower.includes("service_disabled") ||
    lower.includes("api is not enabled") ||
    lower.includes("enable it by visiting") ||
    (lower.includes("businessprofileperformance") &&
      (lower.includes("disabled") || lower.includes("not been used")))
  ) {
    return "Business Profile Performance API im Google Cloud Projekt aktivieren (Superadmin / Google Cloud Console).";
  }
  if (isGoogleQuotaErrorMessage(raw)) {
    return GOOGLE_INSIGHTS_QUOTA_NO_CACHE_MESSAGE;
  }
  return raw;
}

function payloadHasDatedValues(body: GoogleTimeSeriesPayload): boolean {
  return [...collectMetricSeries(body).values()].some((vals) => vals.length > 0);
}

async function fetchMulti(
  accessToken: string,
  location: string,
  start: DateParts,
  end: DateParts,
  restaurantId: string,
): Promise<{ body: GoogleTimeSeriesPayload; error: string | null }> {
  let bestEmptyOk: GoogleTimeSeriesPayload | null = null;
  let lastError: string | null = null;

  for (const style of paramStylesToTry(restaurantId)) {
    const url = buildPerformanceUrl(location, start, end, style);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as GoogleTimeSeriesPayload;
    if (!res.ok) {
      lastError = body.error?.message ?? `google_performance_${res.status}`;
      /** Nur HTTP 429 → kurzer Backoff. Keyword-Match allein sperrt nicht mehr. */
      if (res.status === 429) {
        markGoogleInsightsQuotaExceeded(restaurantId);
        return { body: {}, error: lastError };
      }
      continue;
    }
    if (payloadHasDatedValues(body)) {
      preferredParamStyleByRestaurant.set(restaurantId, style);
      return { body, error: null };
    }
    bestEmptyOk = body;
  }

  if (bestEmptyOk) {
    return { body: bestEmptyOk, error: null };
  }
  return { body: {}, error: lastError };
}

async function fetchSearchKeywords(
  accessToken: string,
  location: string,
  start: DateParts,
  end: DateParts,
  restaurantId: string,
): Promise<GoogleSearchKeywordInsight[]> {
  if (isGoogleInsightsQuotaCooldown(restaurantId)) return [];

  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/${location}/searchkeywords/impressions/monthly`,
  );
  url.searchParams.set("monthlyRange.start_month.year", String(start.year));
  url.searchParams.set("monthlyRange.start_month.month", String(start.month));
  url.searchParams.set("monthlyRange.end_month.year", String(end.year));
  url.searchParams.set("monthlyRange.end_month.month", String(end.month));
  url.searchParams.set("pageSize", "25");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 429) {
    markGoogleInsightsQuotaExceeded(restaurantId);
    return [];
  }
  if (!res.ok) {
    // camelCase month fields (Client-Library-Stil) — nur ein Retry
    const alt = new URL(
      `https://businessprofileperformance.googleapis.com/v1/${location}/searchkeywords/impressions/monthly`,
    );
    alt.searchParams.set("monthlyRange.startMonth.year", String(start.year));
    alt.searchParams.set("monthlyRange.startMonth.month", String(start.month));
    alt.searchParams.set("monthlyRange.endMonth.year", String(end.year));
    alt.searchParams.set("monthlyRange.endMonth.month", String(end.month));
    alt.searchParams.set("pageSize", "25");
    const res2 = await fetch(alt.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res2.status === 429) {
      markGoogleInsightsQuotaExceeded(restaurantId);
      return [];
    }
    if (!res2.ok) return [];
    return parseSearchKeywordsBody(await res2.json().catch(() => ({})));
  }
  return parseSearchKeywordsBody(await res.json().catch(() => ({})));
}

function parseSearchKeywordsBody(body: unknown): GoogleSearchKeywordInsight[] {
  if (!body || typeof body !== "object") return [];
  const rows =
    (body as { searchKeywordsCounts?: unknown[]; search_keywords_counts?: unknown[] })
      .searchKeywordsCounts ??
    (body as { search_keywords_counts?: unknown[] }).search_keywords_counts ??
    [];
  const out: GoogleSearchKeywordInsight[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const keyword =
      (typeof row.searchKeyword === "string" && row.searchKeyword) ||
      (typeof row.search_keyword === "string" && row.search_keyword) ||
      "";
    if (!keyword.trim()) continue;
    const insights =
      (row.insightsValue as Record<string, unknown> | undefined) ??
      (row.insights_value as Record<string, unknown> | undefined) ??
      {};
    const valueRaw = insights.value;
    const thresholdRaw = insights.threshold;
    const value =
      valueRaw == null ? null : Number(typeof valueRaw === "string" ? valueRaw : valueRaw);
    const threshold =
      thresholdRaw == null
        ? null
        : Number(typeof thresholdRaw === "string" ? thresholdRaw : thresholdRaw);
    out.push({
      keyword: keyword.trim(),
      impressions: value != null && Number.isFinite(value) ? value : null,
      threshold: threshold != null && Number.isFinite(threshold) ? threshold : null,
    });
  }
  return out.sort((a, b) => {
    const av = a.impressions ?? a.threshold ?? 0;
    const bv = b.impressions ?? b.threshold ?? 0;
    return bv - av;
  });
}

export async function fetchGoogleBusinessPlatformInsights(params: {
  restaurantId: string;
  startYmd: string;
  endYmd: string;
}): Promise<GoogleBusinessPlatformInsights> {
  const cached = readPlatformInsightsCache<GoogleBusinessPlatformInsights>(
    "google",
    params.restaurantId,
    params.startYmd,
    params.endYmd,
  );
  if (cached) return presentGoogleInsights(cached);

  /** Kurzer 429-Backoff nur mit vorhandenen Daten — sonst live (Sperre war oft leer + Banner). */
  if (isGoogleInsightsQuotaCooldown(params.restaurantId)) {
    const stale =
      readStalePlatformInsightsCacheForRestaurant<GoogleBusinessPlatformInsights>(
        "google",
        params.restaurantId,
      );
    if (stale) return presentGoogleInsights(stale);
  }

  const result = await fetchGoogleBusinessPlatformInsightsLive(params);
  writePlatformInsightsCache(
    "google",
    params.restaurantId,
    params.startYmd,
    params.endYmd,
    result,
    (data) => data.connected && !data.error,
  );
  if (result.connected && !result.error) {
    clearGoogleInsightsQuotaCooldown(params.restaurantId);
  }
  return result;
}

async function fetchGoogleBusinessPlatformInsightsLive(params: {
  restaurantId: string;
  startYmd: string;
  endYmd: string;
}): Promise<GoogleBusinessPlatformInsights> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(params.restaurantId);
  if ("error" in auth) {
    return emptyGoogleInsights({
      connected: false,
      error: humanizeGooglePerformanceError(auth.error),
    });
  }

  const location = locationResourceName(auth.config.location_name ?? "");
  if (!location) {
    return emptyGoogleInsights({
      connected: true,
      error: "Standort in der Google-Verbindung fehlt — unter Integrationen wählen.",
    });
  }

  const clamped = clampGooglePerformanceRange(params.startYmd, params.endYmd);
  if (!clamped) {
    return emptyGoogleInsights({
      connected: true,
      error: "Für den gewählten Zeitraum liegen noch keine Google-Performance-Daten vor.",
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

  const multi = await fetchMulti(
    auth.accessToken,
    location,
    start,
    end,
    params.restaurantId,
  );
  let byMetric = multi.error
    ? new Map<string, GoogleDatedValue[]>()
    : collectMetricSeries(multi.body);

  const multiHadData = [...byMetric.values()].some((v) => v.length > 0);
  if (multi.error && !multiHadData) {
    const stale =
      readStalePlatformInsightsCacheForRestaurant<GoogleBusinessPlatformInsights>(
        "google",
        params.restaurantId,
      );
    if (stale) {
      return presentGoogleInsights(stale);
    }
    return emptyGoogleInsights({
      connected: true,
      error: humanizeGooglePerformanceError(multi.error),
    });
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
  const foodOrdersSeries = seriesFromDatedValues(
    "food_orders",
    "Essensbestellungen",
    byMetric.get("BUSINESS_FOOD_ORDERS"),
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
    foodOrdersSeries,
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
  const foodOrders = foodOrdersSeries.total;
  const interactions = interactionsSeries.total;

  const searchKeywords = await fetchSearchKeywords(
    auth.accessToken,
    location,
    start,
    end,
    params.restaurantId,
  );

  // Immer alle Kernmetriken zeigen — auch mit 0 — damit klar ist, was gemessen wird.
  const metrics: PlatformInsightMetric[] = [
    { key: "impressions", label: "Aufrufe", value: impressions },
    { key: "search", label: "Suche", value: searchImpressions },
    { key: "maps", label: "Maps", value: mapsImpressions },
    { key: "search_desktop", label: "Suche Desktop", value: desktopSearch.total },
    { key: "search_mobile", label: "Suche Mobile", value: mobileSearch.total },
    { key: "maps_desktop", label: "Maps Desktop", value: desktopMaps.total },
    { key: "maps_mobile", label: "Maps Mobile", value: mobileMaps.total },
    { key: "interactions", label: "Interaktionen", value: interactions },
    { key: "calls", label: "Anrufe", value: callClicks },
    { key: "website", label: "Website", value: websiteClicks },
    { key: "directions", label: "Routen", value: directionRequests },
    { key: "conversations", label: "Nachrichten", value: conversations },
    { key: "bookings", label: "Buchungen", value: bookings },
    { key: "menu", label: "Menü", value: menuClicks },
    { key: "food_orders", label: "Essensbestellungen", value: foodOrders },
  ];

  const hasAnySeries =
    impressionsSeries.byDay.length > 0 ||
    interactionsSeries.byDay.length > 0 ||
    searchKeywords.length > 0;

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
      conversationsSeries,
      bookingsSeries,
      menuClicksSeries,
      foodOrdersSeries,
      desktopSearch,
      mobileSearch,
      desktopMaps,
      mobileMaps,
    ],
    impressions,
    searchImpressions,
    mapsImpressions,
    searchDesktop: desktopSearch.total,
    searchMobile: mobileSearch.total,
    mapsDesktop: desktopMaps.total,
    mapsMobile: mobileMaps.total,
    websiteClicks,
    callClicks,
    directionRequests,
    conversations,
    bookings,
    menuClicks,
    foodOrders,
    interactions,
    searchKeywords,
  };
}
