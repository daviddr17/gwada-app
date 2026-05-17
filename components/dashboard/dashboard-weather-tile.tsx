"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  CloudRain,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton"
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context"
import {
  buildVisualCrossingLocation,
  DEFAULT_WEATHER_LOCATION,
} from "@/lib/weather/visual-crossing-location"
import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types"
import { cn } from "@/lib/utils"

const nf1 = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

function formatTemp(c?: number): string {
  if (c === undefined || Number.isNaN(c)) return "—"
  return `${nf1.format(c)} °C`
}

function formatPercent(v?: number): string {
  if (v === undefined || Number.isNaN(v)) return "—"
  return `${nf1.format(v)} %`
}

function formatTimeDe(iso?: string): string {
  if (!iso?.trim()) return "—"
  const d = new Date(iso)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/)
  return m?.[1] ?? iso
}

/** 8 Himmelsrichtungen, `deg` meteorologisch (0 = Nord). */
function windDirectionDe(deg?: number): string {
  if (deg === undefined || Number.isNaN(deg)) return "—"
  const dirs = [
    "Nord",
    "Nordost",
    "Ost",
    "Südost",
    "Süd",
    "Südwest",
    "West",
    "Nordwest",
  ]
  const x = (((deg + 11.25) % 360) + 360) % 360
  const i = Math.floor(x / 45) % 8
  return dirs[i] ?? "—"
}

function WeatherGlyph({
  icon,
  className,
}: {
  icon?: string
  className?: string
}) {
  const k = (icon ?? "").toLowerCase()
  const c = cn("size-9 shrink-0 text-sky-600 dark:text-sky-400", className)
  if (k.includes("snow")) return <CloudRain className={c} aria-hidden />
  if (k.includes("rain") || k.includes("shower"))
    return <CloudRain className={c} aria-hidden />
  if (k.includes("fog") || k.includes("haze")) return <Cloud className={c} aria-hidden />
  if (k.includes("clear")) return <Sun className={c} aria-hidden />
  if (k.includes("cloud") && k.includes("part"))
    return <CloudSun className={c} aria-hidden />
  if (k.includes("cloud") || k.includes("overcast"))
    return <Cloud className={c} aria-hidden />
  return <CloudSun className={c} aria-hidden />
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-xs sm:text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[min(100%,14rem)] text-right font-medium text-foreground">
        {value}
      </span>
    </div>
  )
}

/** Kompaktes Layout — gleiche Struktur wie geladene Kachel, mit sichtbarem Shimmer. */
function WeatherTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-3 pt-0.5", className)}
      aria-busy
      aria-label="Wetter wird geladen"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2.5">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-36 max-w-[min(100%,12rem)] rounded-md" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="ml-auto h-3.5 w-28 rounded-md" />
          <Skeleton className="ml-auto h-3.5 w-16 rounded-md" />
          <Skeleton className="ml-auto h-3.5 w-16 rounded-md" />
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 py-2 first:pt-0"
          >
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-32 rounded-md" />
          </div>
        ))}
      </div>
      <Skeleton className="h-12 w-full max-w-full rounded-md" />
    </div>
  )
}

export function DashboardWeatherTile() {
  const { profile, isReady: profileReady } = useRestaurantProfile()
  const location = useMemo(() => buildVisualCrossingLocation(profile), [profile])

  const [data, setData] = useState<VisualCrossingTimelineResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (loc: string) => {
    setLoading(true)
    setErr(null)
    setData(null)
    try {
      const u = new URL("/api/weather", window.location.origin)
      u.searchParams.set("location", loc)
      const res = await fetch(u.toString())
      const json = (await res.json()) as
        | VisualCrossingTimelineResponse
        | { error?: string }

      if (!res.ok) {
        const code = "error" in json ? json.error : undefined
        if (code === "missing_api_key") {
          setErr(
            "Wetterdaten: Es fehlt VISUAL_CROSSING_API_KEY in der Umgebungskonfiguration.",
          )
        } else {
          setErr("Wetterdaten konnten nicht geladen werden.")
        }
        setData(null)
        return
      }

      setData(json as VisualCrossingTimelineResponse)
    } catch {
      setErr("Wetterdaten konnten nicht geladen werden.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!profileReady) return
    void load(location)
  }, [profileReady, location, load])

  const today = data?.days?.[0]
  const cur = data?.currentConditions

  const subtitle = useMemo(() => {
    if (!profileReady) return "…"
    if (location === DEFAULT_WEATHER_LOCATION && !profile.city?.trim()) {
      return `Ort: ${DEFAULT_WEATHER_LOCATION} (Standard, kein Ort in den Stammdaten)`
    }
    return `Ort: ${location}`
  }, [profileReady, location, profile.city])

  const showSkeleton =
    profileReady && (loading || (!data && !err))

  if (!profileReady) {
    return (
      <SkeletonCardFrame className="h-full w-full min-w-0 border-border/50 shadow-card">
        <div className="space-y-2 pb-1">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-48 max-w-full rounded-md" />
        </div>
        <div className="border-t border-border/40 pt-3">
          <WeatherTileSkeleton />
        </div>
      </SkeletonCardFrame>
    )
  }

  return (
    <Card className="h-full w-full min-w-0 border-border/50 shadow-card">
      <CardHeader className="space-y-0 pb-1.5 pt-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          Wetter
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        {err ? (
          <p className="text-xs text-muted-foreground sm:text-sm">{err}</p>
        ) : showSkeleton ? (
          <WeatherTileSkeleton />
        ) : !cur ? (
          <p className="text-xs text-muted-foreground sm:text-sm">
            Keine aktuellen Wetterdaten verfügbar.
          </p>
        ) : (
          <div className="space-y-0">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <WeatherGlyph icon={cur.icon} />
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                    {formatTemp(cur.temp)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    {cur.conditions ?? "—"}
                  </p>
                </div>
              </div>
              <div className="shrink-0 space-y-0.5 text-right text-xs sm:text-sm">
                <p className="text-muted-foreground">
                  gefühlt{" "}
                  <span className="font-medium text-foreground">
                    {formatTemp(cur.feelslike)}
                  </span>
                </p>
                <p className="flex items-center justify-end gap-1 tabular-nums">
                  <ArrowUp
                    className="size-3.5 shrink-0 text-muted-foreground sm:size-4"
                    aria-hidden
                  />
                  <span>{formatTemp(today?.tempmax)}</span>
                </p>
                <p className="flex items-center justify-end gap-1 tabular-nums">
                  <ArrowDown
                    className="size-3.5 shrink-0 text-muted-foreground sm:size-4"
                    aria-hidden
                  />
                  <span>{formatTemp(today?.tempmin)}</span>
                </p>
              </div>
            </div>

            <Separator />

            <div className="divide-y divide-border/60">
              <MetricRow
                label="Wind"
                value={
                  cur.windspeed !== undefined
                    ? `${nf1.format(cur.windspeed)} km/h von ${windDirectionDe(cur.winddir)}`
                    : "—"
                }
              />
              <MetricRow
                label="Niederschlag"
                value={`Aktuell: ${formatPercent(cur.precipprob)} | Heute: ${formatPercent(today?.precipprob)}`}
              />
              <MetricRow
                label="Feuchtigkeit"
                value={formatPercent(cur.humidity)}
              />
              <MetricRow
                label="UV-Index"
                value={
                  cur.uvindex !== undefined && !Number.isNaN(cur.uvindex)
                    ? String(cur.uvindex)
                    : "—"
                }
              />
            </div>

            <Separator className="my-2.5" />

            <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums sm:gap-5 sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Sun className="size-3.5 text-amber-500 sm:size-4" aria-hidden />
                {formatTimeDe(today?.sunrise)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Moon className="size-3.5 text-indigo-400 sm:size-4" aria-hidden />
                {formatTimeDe(today?.sunset)}
              </span>
            </div>

            {(today?.description ?? data?.description) && (
              <>
                <Separator className="my-2.5" />
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  <span className="font-medium text-foreground">
                    Tagesvorhersage:{" "}
                  </span>
                  {today?.description ?? data?.description}
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
