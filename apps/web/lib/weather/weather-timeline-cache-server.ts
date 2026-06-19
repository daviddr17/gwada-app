import "server-only";

import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Wetter ändert sich langsam — DB-Cache, still nach TTL erneuern. */
export const WEATHER_TIMELINE_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

export function weatherTimelineCacheKey(params: {
  location: string;
  from: string | null;
  to: string | null;
}): string {
  const loc = params.location.trim().toLowerCase();
  const from = params.from?.trim() || "today";
  const to = params.to?.trim() || "today";
  return `${loc}|${from}|${to}`;
}

export async function readWeatherTimelineCache(
  cacheKey: string,
): Promise<{
  data: VisualCrossingTimelineResponse;
  fetchedAt: string;
  stale: boolean;
} | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("weather_timeline_cache")
    .select("payload, fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !data) return null;

  const fetchedAt = (data as { fetched_at: string }).fetched_at;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const payload = (data as { payload: VisualCrossingTimelineResponse }).payload;

  return {
    data: payload,
    fetchedAt,
    stale: ageMs > WEATHER_TIMELINE_CACHE_TTL_MS,
  };
}

export async function writeWeatherTimelineCache(params: {
  cacheKey: string;
  location: string;
  from: string | null;
  to: string | null;
  data: VisualCrossingTimelineResponse;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  await admin.from("weather_timeline_cache").upsert(
    {
      cache_key: params.cacheKey,
      location: params.location,
      from_date: params.from,
      to_date: params.to,
      payload: params.data,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
}

export async function fetchVisualCrossingTimeline(params: {
  apiKey: string;
  pathLoc: string;
  from: string | null;
  to: string | null;
  timelinePath: string;
}): Promise<
  | { ok: true; data: VisualCrossingTimelineResponse }
  | { ok: false; error: "fetch_failed" | "upstream_error"; status?: number }
> {
  const upstream = new URL(
    `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/${params.timelinePath}`,
  );
  upstream.searchParams.set(
    "include",
    params.from && params.to ? "days" : "current,days",
  );
  upstream.searchParams.set("unitGroup", "metric");
  upstream.searchParams.set("lang", "de");
  upstream.searchParams.set("key", params.apiKey);

  let res: Response;
  try {
    res = await fetch(upstream.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    return { ok: false, error: "fetch_failed" };
  }

  if (!res.ok) {
    return { ok: false, error: "upstream_error", status: res.status };
  }

  const data = (await res.json()) as VisualCrossingTimelineResponse;
  return { ok: true, data };
}
