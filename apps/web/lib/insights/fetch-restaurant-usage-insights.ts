import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  EMBED_USAGE_DIMENSIONS,
  EMBED_USAGE_LABELS,
  emptyRestaurantUsageInsights,
  PROFILE_MODULE_USAGE_LABELS,
  PROFILE_USAGE_VIEW_DIMENSION,
  type EmbedUsageDimension,
  type RestaurantUsageBreakdownRow,
  type RestaurantUsageInsights,
  type RestaurantUsageSource,
} from "@/lib/insights/restaurant-usage-constants";

export type {
  RestaurantUsageBreakdownRow,
  RestaurantUsageInsights,
} from "@/lib/insights/restaurant-usage-constants";

function ymdOnly(isoOrYmd: string): string {
  return isoOrYmd.slice(0, 10);
}

export async function fetchRestaurantUsageInsights(params: {
  restaurantId: string;
  startYmd: string;
  endYmd: string;
}): Promise<RestaurantUsageInsights> {
  const admin = createSupabaseAdminClient();
  if (!admin) return emptyRestaurantUsageInsights();

  const start = ymdOnly(params.startYmd);
  const end = ymdOnly(params.endYmd);
  if (!start || !end || start > end) return emptyRestaurantUsageInsights();

  const { data, error } = await admin
    .from("restaurant_usage_daily")
    .select("day, source, dimension, count")
    .eq("restaurant_id", params.restaurantId)
    .gte("day", start)
    .lte("day", end);

  if (error) {
    console.warn("fetchRestaurantUsageInsights", error.message);
    return emptyRestaurantUsageInsights();
  }

  const embedMap = new Map<string, number>();
  const apiMap = new Map<string, number>();
  const profileModuleMap = new Map<string, number>();
  let profileViews = 0;

  for (const raw of data ?? []) {
    const row = raw as {
      source: RestaurantUsageSource;
      dimension: string;
      count: number | string;
    };
    const count = Number(row.count) || 0;
    if (count <= 0) continue;

    if (row.source === "embed") {
      embedMap.set(row.dimension, (embedMap.get(row.dimension) ?? 0) + count);
    } else if (row.source === "api") {
      const key = row.dimension.startsWith("api:")
        ? row.dimension.slice(4)
        : row.dimension;
      apiMap.set(key, (apiMap.get(key) ?? 0) + count);
    } else if (row.source === "profile") {
      if (row.dimension === PROFILE_USAGE_VIEW_DIMENSION) {
        profileViews += count;
      } else if (row.dimension.startsWith("module:")) {
        const key = row.dimension.slice("module:".length);
        profileModuleMap.set(key, (profileModuleMap.get(key) ?? 0) + count);
      }
    }
  }

  const embedByWidget: RestaurantUsageBreakdownRow[] = EMBED_USAGE_DIMENSIONS.map(
    (id: EmbedUsageDimension) => ({
      key: id,
      label: EMBED_USAGE_LABELS[id],
      count: embedMap.get(id) ?? 0,
    }),
  ).filter((r) => r.count > 0);

  for (const [key, count] of embedMap) {
    if (!EMBED_USAGE_DIMENSIONS.includes(key as EmbedUsageDimension)) {
      embedByWidget.push({ key, label: key, count });
    }
  }
  embedByWidget.sort((a, b) => b.count - a.count);

  const apiByModule = [...apiMap.entries()]
    .map(([key, count]) => ({
      key,
      label: EMBED_USAGE_LABELS[key as EmbedUsageDimension] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const profileByModule = [...profileModuleMap.entries()]
    .map(([key, count]) => ({
      key,
      label: PROFILE_MODULE_USAGE_LABELS[key] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    embedViews: [...embedMap.values()].reduce((a, b) => a + b, 0),
    apiRequests: [...apiMap.values()].reduce((a, b) => a + b, 0),
    profileViews,
    profileModuleOpens: [...profileModuleMap.values()].reduce((a, b) => a + b, 0),
    embedByWidget,
    apiByModule,
    profileByModule,
  };
}
