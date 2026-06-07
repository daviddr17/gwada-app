"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudSun } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  buildVisualCrossingLocation,
  DEFAULT_WEATHER_LOCATION,
} from "@/lib/weather/visual-crossing-location";
import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";
import { DashboardWeatherAmbience } from "@/components/dashboard/dashboard-weather-ambience";
import { GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { resolveWeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";

const nf1 = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatTemp(c?: number): string {
  if (c === undefined || Number.isNaN(c)) return "—";
  return `${nf1.format(c)} °C`;
}

function formatPercent(v?: number): string {
  if (v === undefined || Number.isNaN(v)) return "—";
  return `${nf1.format(v)} %`;
}

function formatTimeDe(iso?: string): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m?.[1] ?? iso;
}

function windLabel(deg?: number, speed?: number): string {
  if (speed === undefined || Number.isNaN(speed)) return "—";
  const dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  let dir = "";
  if (deg !== undefined && !Number.isNaN(deg)) {
    const x = (((deg + 22.5) % 360) + 360) % 360;
    dir = dirs[Math.floor(x / 45) % 8] ?? "";
  }
  return dir ? `${nf1.format(speed)} km/h ${dir}` : `${nf1.format(speed)} km/h`;
}

export function DashboardWeatherTile() {
  const { profile, isReady: profileReady } = useRestaurantProfile();
  const location = useMemo(() => buildVisualCrossingLocation(profile), [profile]);

  const [data, setData] = useState<VisualCrossingTimelineResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasDataRef = useRef(false);

  const load = useCallback(async (loc: string, silent = false) => {
    const initial = !hasDataRef.current;
    if (!silent && initial) setLoading(true);
    if (!silent) setErr(null);
    if (!silent) setData(null);
    try {
      const u = new URL("/api/weather", window.location.origin);
      u.searchParams.set("location", loc);
      const res = await fetch(u.toString());
      const json = (await res.json()) as
        | VisualCrossingTimelineResponse
        | { error?: string };

      if (!res.ok) {
        const code = "error" in json ? json.error : undefined;
        if (!hasDataRef.current) {
          if (code === "missing_api_key") {
            setErr(
              "Visual-Crossing-API-Key fehlt (Superadmin → Integrationen).",
            );
          } else {
            setErr("Wetterdaten konnten nicht geladen werden.");
          }
        }
        return;
      }

      setData(json as VisualCrossingTimelineResponse);
      hasDataRef.current = true;
    } catch {
      if (!hasDataRef.current) {
        setErr("Wetterdaten konnten nicht geladen werden.");
      }
    } finally {
      if (!silent && initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profileReady) return;
    hasDataRef.current = false;
    void load(location, false);
  }, [profileReady, location, load]);

  useEffect(() => {
    if (!profileReady) return;
    const onPoll = () => void load(location, true);
    window.addEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
    return () =>
      window.removeEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
  }, [profileReady, location, load]);

  const today = data?.days?.[0];
  const cur = data?.currentConditions;
  const showSkeleton = useDeferredSkeleton(
    profileReady && loading && !data && !err,
  );

  const ambienceKind = useMemo(
    () =>
      resolveWeatherAmbienceKind({
        icon: cur?.icon,
        conditions: cur?.conditions,
      }),
    [cur?.icon, cur?.conditions],
  );

  const locationHint = useMemo(() => {
    if (!profileReady) return "";
    if (location === DEFAULT_WEATHER_LOCATION && !profile.city?.trim()) {
      return DEFAULT_WEATHER_LOCATION;
    }
    return location;
  }, [profileReady, location, profile.city]);

  return (
    <DashboardWidgetShell
      title="Wetter"
      icon={
        <CloudSun
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      ready={profileReady}
      loading={showSkeleton}
      error={err}
      background={
        cur ? (
          <DashboardWeatherAmbience kind={ambienceKind} className="rounded-none" />
        ) : undefined
      }
    >
      {cur ? (
        <div className="space-y-2">
          <p className="truncate text-xs text-muted-foreground">
            {cur.conditions ?? "—"}
            {locationHint ? ` · ${locationHint}` : null}
          </p>
          <DashboardCompactInlineMetrics>
            <DashboardCompactMetricPill
              label="Jetzt"
              value={formatTemp(cur.temp)}
            />
            <DashboardCompactMetricPill
              label="Gefühlt"
              value={formatTemp(cur.feelslike)}
            />
            <DashboardCompactMetricPill
              label="Heute max"
              value={formatTemp(today?.tempmax)}
            />
            <DashboardCompactMetricPill
              label="Heute min"
              value={formatTemp(today?.tempmin)}
            />
            <DashboardCompactMetricPill
              label="Wind"
              value={windLabel(cur.winddir, cur.windspeed)}
            />
            <DashboardCompactMetricPill
              label="Regen"
              value={formatPercent(today?.precipprob ?? cur.precipprob)}
            />
            <DashboardCompactMetricPill
              label="Feuchtigkeit"
              value={formatPercent(cur.humidity)}
            />
            {(today?.sunrise || today?.sunset) && (
              <DashboardCompactMetricPill
                label="Sonne"
                value={`↑ ${formatTimeDe(today?.sunrise)} · ↓ ${formatTimeDe(today?.sunset)}`}
              />
            )}
          </DashboardCompactInlineMetrics>
        </div>
      ) : !err ? (
        <p className="text-xs text-muted-foreground">
          Keine aktuellen Wetterdaten verfügbar.
        </p>
      ) : null}
    </DashboardWidgetShell>
  );
}
