import { after } from "next/server";
import { DEFAULT_WEATHER_LOCATION } from "@/lib/weather/visual-crossing-location";
import { getVisualCrossingApiKeyAdmin } from "@/lib/weather/visual-crossing-api-key";
import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";
import {
  fetchVisualCrossingTimeline,
  readWeatherTimelineCache,
  weatherTimelineCacheKey,
  writeWeatherTimelineCache,
} from "@/lib/weather/weather-timeline-cache-server";
import { isLocalDayKey, dayOffsetLocal } from "@/lib/staff/shift-schedule-range";

/** Route dynamisch — Antwort kommt aus DB-Cache, Visual Crossing nur bei Miss/Stale. */
export const dynamic = "force-dynamic";

const LOCATION_MAX = 120;
const MAX_FORECAST_DAYS = 45;

function isSafeLocationToken(s: string): boolean {
  if (s.length > LOCATION_MAX) return false;
  return /^[\p{L}\p{N}\s,.''\-]+$/u.test(s);
}

function resolveTimelinePath(
  pathLoc: string,
  from: string | null,
  to: string | null,
): { path: string } | { error: "invalid_date_range" | "date_range_too_long" } {
  if (!from && !to) {
    return { path: `timeline/${pathLoc}/today` };
  }
  if (!from || !to || !isLocalDayKey(from) || !isLocalDayKey(to)) {
    return { error: "invalid_date_range" };
  }
  if (from > to) {
    return { error: "invalid_date_range" };
  }
  if (dayOffsetLocal(from, to) > MAX_FORECAST_DAYS) {
    return { error: "date_range_too_long" };
  }
  return { path: `timeline/${pathLoc}/${from}/${to}` };
}

async function refreshWeatherTimelineCache(params: {
  apiKey: string;
  location: string;
  pathLoc: string;
  from: string | null;
  to: string | null;
  timelinePath: string;
  cacheKey: string;
}): Promise<
  | { ok: true; data: VisualCrossingTimelineResponse }
  | { ok: false; error: "fetch_failed" | "upstream_error"; status?: number }
> {
  const upstream = await fetchVisualCrossingTimeline({
    apiKey: params.apiKey,
    pathLoc: params.pathLoc,
    from: params.from,
    to: params.to,
    timelinePath: params.timelinePath,
  });
  if (!upstream.ok) return upstream;

  await writeWeatherTimelineCache({
    cacheKey: params.cacheKey,
    location: params.location,
    from: params.from,
    to: params.to,
    data: upstream.data,
  });

  return upstream;
}

/**
 * Wetter-Timeline: DB-Cache (3 h TTL), bei Stale stale-while-revalidate.
 * Query: `location` optional; `from`/`to` optional (YYYY-MM-DD).
 */
export async function GET(req: Request) {
  const key = await getVisualCrossingApiKeyAdmin();
  if (!key) {
    return Response.json(
      { error: "missing_api_key" as const },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const raw =
    searchParams.get("location")?.trim() || DEFAULT_WEATHER_LOCATION;
  if (!isSafeLocationToken(raw)) {
    return Response.json({ error: "invalid_location" as const }, { status: 400 });
  }

  const pathLoc = encodeURIComponent(raw);
  const from = searchParams.get("from")?.trim() || null;
  const to = searchParams.get("to")?.trim() || null;
  const timeline = resolveTimelinePath(pathLoc, from, to);
  if ("error" in timeline) {
    return Response.json({ error: timeline.error }, { status: 400 });
  }

  const cacheKey = weatherTimelineCacheKey({ location: raw, from, to });
  const cached = await readWeatherTimelineCache(cacheKey);

  if (cached && !cached.stale) {
    return Response.json(cached.data);
  }

  if (cached?.stale) {
    after(() => {
      void refreshWeatherTimelineCache({
        apiKey: key,
        location: raw,
        pathLoc,
        from,
        to,
        timelinePath: timeline.path,
        cacheKey,
      });
    });
    return Response.json(cached.data);
  }

  const fresh = await refreshWeatherTimelineCache({
    apiKey: key,
    location: raw,
    pathLoc,
    from,
    to,
    timelinePath: timeline.path,
    cacheKey,
  });

  if (!fresh.ok) {
    return Response.json(
      { error: fresh.error, ...(fresh.status ? { status: fresh.status } : {}) },
      { status: 502 },
    );
  }

  return Response.json(fresh.data);
}
