import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyticsRangeBounds,
  isAnalyticsRange,
  type AnalyticsRange,
} from "@/lib/analytics/analytics-range";
import { isAnalyticsUuid } from "@/lib/analytics/parse-analytics-request";
import {
  emptyProductUsage,
  emptyWebsiteAnalytics,
  isAnalyticsSchemaMissing,
  parseProductUsage,
  parseWebsiteAnalytics,
  type ProductUsageAnalytics,
  type WebsiteAnalytics,
} from "@/lib/analytics/platform-analytics-types";

const FILTER_TOKEN = /^[a-z0-9_-]{1,40}$/;

export type AnalyticsLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "migration_missing" | "invalid_range" | "query_failed" };

function bounds(range: AnalyticsRange, now = new Date()) {
  const { from, to } = analyticsRangeBounds(range, now);
  if (to.getTime() <= from.getTime()) {
    return { from, to: new Date(from.getTime() + 1000) };
  }
  return { from, to };
}

function optionalToken(value: string | null): string | null {
  if (!value || value === "all") return null;
  return FILTER_TOKEN.test(value) ? value : null;
}

export async function loadWebsiteAnalytics(
  admin: SupabaseClient,
  params: {
    range: string | null;
    device: string | null;
    browser: string | null;
    country: string | null;
    surface: string | null;
    now?: Date;
  },
): Promise<AnalyticsLoadResult<WebsiteAnalytics>> {
  const range: AnalyticsRange = isAnalyticsRange(params.range) ? params.range : "30d";
  const { from, to } = bounds(range, params.now);
  const country =
    params.country === "__none" || (params.country && /^[A-Z]{2}$/.test(params.country))
      ? params.country
      : null;
  const { data, error } = await admin.rpc("platform_website_analytics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_device: optionalToken(params.device),
    p_browser: optionalToken(params.browser),
    p_country: country,
    p_surface: optionalToken(params.surface),
  });
  if (error) {
    if (isAnalyticsSchemaMissing(error.message)) {
      return { ok: false, error: "migration_missing" };
    }
    if (/invalid_range|range_too_wide/.test(error.message)) {
      return { ok: false, error: "invalid_range" };
    }
    console.warn("[gwada] platform_website_analytics", error.message);
    return { ok: false, error: "query_failed" };
  }
  return {
    ok: true,
    data: parseWebsiteAnalytics(data, from.toISOString(), to.toISOString()),
  };
}

export async function loadProductUsageAnalytics(
  admin: SupabaseClient,
  params: {
    range: string | null;
    moduleId: string | null;
    restaurantId: string | null;
    now?: Date;
  },
): Promise<AnalyticsLoadResult<ProductUsageAnalytics>> {
  const range: AnalyticsRange = isAnalyticsRange(params.range) ? params.range : "30d";
  const { from, to } = bounds(range, params.now);
  const restaurantId = isAnalyticsUuid(params.restaurantId) ? params.restaurantId : null;
  const { data, error } = await admin.rpc("platform_product_usage", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_module: optionalToken(params.moduleId),
    p_restaurant: restaurantId,
  });
  if (error) {
    if (isAnalyticsSchemaMissing(error.message)) {
      return { ok: false, error: "migration_missing" };
    }
    if (/invalid_range|range_too_wide/.test(error.message)) {
      return { ok: false, error: "invalid_range" };
    }
    console.warn("[gwada] platform_product_usage", error.message);
    return { ok: false, error: "query_failed" };
  }
  const parsed = parseProductUsage(data, from.toISOString(), to.toISOString());
  return { ok: true, data: parsed ?? emptyProductUsage(from.toISOString(), to.toISOString()) };
}

export function unavailableWebsite(now = new Date()): WebsiteAnalytics {
  const { from, to } = bounds("30d", now);
  return emptyWebsiteAnalytics(from.toISOString(), to.toISOString());
}
