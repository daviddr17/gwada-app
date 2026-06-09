import { DEFAULT_WEATHER_LOCATION } from "@/lib/weather/visual-crossing-location"
import { getVisualCrossingApiKeyAdmin } from "@/lib/weather/visual-crossing-api-key"
import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types"
import { isLocalDayKey, dayOffsetLocal } from "@/lib/staff/shift-schedule-range"

/** Niemals statisch cachen: Key darf nicht in Build-/Data-Cache landen. */
export const dynamic = "force-dynamic"

const LOCATION_MAX = 120
const MAX_FORECAST_DAYS = 45

function isSafeLocationToken(s: string): boolean {
  if (s.length > LOCATION_MAX) return false
  return /^[\p{L}\p{N}\s,.''\-]+$/u.test(s)
}

function resolveTimelinePath(
  pathLoc: string,
  from: string | null,
  to: string | null,
): { path: string } | { error: "invalid_date_range" | "date_range_too_long" } {
  if (!from && !to) {
    return { path: `timeline/${pathLoc}/today` }
  }
  if (!from || !to || !isLocalDayKey(from) || !isLocalDayKey(to)) {
    return { error: "invalid_date_range" }
  }
  if (from > to) {
    return { error: "invalid_date_range" }
  }
  if (dayOffsetLocal(from, to) > MAX_FORECAST_DAYS) {
    return { error: "date_range_too_long" }
  }
  return { path: `timeline/${pathLoc}/${from}/${to}` }
}

/**
 * Proxy für Visual Crossing Timeline (API-Key bleibt serverseitig).
 * Query: `location` optional; `from`/`to` optional (YYYY-MM-DD) für Tagesbereich.
 */
export async function GET(req: Request) {
  const key = await getVisualCrossingApiKeyAdmin()
  if (!key) {
    return Response.json(
      { error: "missing_api_key" as const },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const raw =
    searchParams.get("location")?.trim() || DEFAULT_WEATHER_LOCATION
  if (!isSafeLocationToken(raw)) {
    return Response.json({ error: "invalid_location" as const }, { status: 400 })
  }

  const pathLoc = encodeURIComponent(raw)
  const from = searchParams.get("from")?.trim() || null
  const to = searchParams.get("to")?.trim() || null
  const timeline = resolveTimelinePath(pathLoc, from, to)
  if ("error" in timeline) {
    return Response.json({ error: timeline.error }, { status: 400 })
  }

  const upstream = new URL(
    `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/${timeline.path}`,
  )
  upstream.searchParams.set("include", from && to ? "days" : "current,days")
  upstream.searchParams.set("unitGroup", "metric")
  upstream.searchParams.set("lang", "de")
  upstream.searchParams.set("key", key)

  let res: Response
  try {
    /* `cache: 'no-store'`: verhindert, dass Next die vollständige URL (inkl. `key=`) im Fetch-Data-Cache speichert. */
    res = await fetch(upstream.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
  } catch {
    return Response.json({ error: "fetch_failed" as const }, { status: 502 })
  }

  if (!res.ok) {
    return Response.json(
      { error: "upstream_error" as const, status: res.status },
      { status: 502 },
    )
  }

  const data = (await res.json()) as VisualCrossingTimelineResponse
  return Response.json(data)
}
