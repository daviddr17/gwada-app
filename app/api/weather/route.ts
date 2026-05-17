import { DEFAULT_WEATHER_LOCATION } from "@/lib/weather/visual-crossing-location"
import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types"

/** Niemals statisch cachen: Key darf nicht in Build-/Data-Cache landen. */
export const dynamic = "force-dynamic"

const LOCATION_MAX = 120

function isSafeLocationToken(s: string): boolean {
  if (s.length > LOCATION_MAX) return false
  return /^[\p{L}\p{N}\s,.''\-]+$/u.test(s)
}

/**
 * Proxy für Visual Crossing Timeline (API-Key bleibt serverseitig).
 * Query: `location` optional (z. B. `Berlin,DE`), sonst Default Frankfurt.
 */
export async function GET(req: Request) {
  const key = process.env.VISUAL_CROSSING_API_KEY?.trim()
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
  const upstream = new URL(
    `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${pathLoc}/today`,
  )
  /* `days` für Tageshoch/Tief, Sonnenauf-/untergang und Text; Kosten gering bei `/today`. */
  upstream.searchParams.set("include", "current,days")
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
