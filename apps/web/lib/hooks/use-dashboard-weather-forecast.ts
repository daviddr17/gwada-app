"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DASHBOARD_WEATHER_FORECAST_DAYS,
  peekDashboardWeatherForecastCache,
  writeDashboardWeatherForecastCache,
} from "@/lib/weather/dashboard-weather-forecast-cache";
import type { VisualCrossingDay } from "@/lib/weather/visual-crossing-types";
import {
  addRestaurantCalendarDaysYmd,
  restaurantTodayYmd,
} from "@/lib/restaurant/restaurant-timezone";

type WeatherApiError = { error: string };

/**
 * Prognose nur bei Bedarf (Sheet offen) — kein Hintergrund-Polling.
 * Server- und Client-Cache: 3 h (siehe weather_timeline_cache / localStorage).
 */
export function useDashboardWeatherForecast(params: {
  location: string;
  timeZone: string;
  enabled: boolean;
}): {
  days: VisualCrossingDay[];
  loading: boolean;
  error: string | null;
  fromYmd: string;
  toYmd: string;
} {
  const { location, timeZone, enabled } = params;
  const fromYmd = restaurantTodayYmd(timeZone);
  const toYmd = addRestaurantCalendarDaysYmd(
    fromYmd,
    DASHBOARD_WEATHER_FORECAST_DAYS - 1,
    timeZone,
  );

  const cachedOnMount =
    enabled ? peekDashboardWeatherForecastCache(location, fromYmd, toYmd) : null;
  const [days, setDays] = useState<VisualCrossingDay[]>(
    () => cachedOnMount?.days ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(cachedOnMount != null);

  const load = useCallback(async () => {
    if (!location.trim()) return;

    const cached = peekDashboardWeatherForecastCache(location, fromYmd, toYmd);
    if (cached?.days?.length) {
      setDays(cached.days);
      hasDataRef.current = true;
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const initial = !hasDataRef.current;
    if (initial) {
      setLoading(true);
      setError(null);
    }

    try {
      const u = new URL("/api/weather", window.location.origin);
      u.searchParams.set("location", location);
      u.searchParams.set("from", fromYmd);
      u.searchParams.set("to", toYmd);
      const res = await fetch(u.toString());
      const json = (await res.json()) as
        | { days?: VisualCrossingDay[] }
        | WeatherApiError;

      if (requestId !== requestIdRef.current) return;

      if (!res.ok || "error" in json) {
        if (!hasDataRef.current) {
          const code = "error" in json ? json.error : undefined;
          setError(
            code === "missing_api_key"
              ? "Visual-Crossing-API-Key fehlt (Superadmin → Integrationen)."
              : "Prognose konnte nicht geladen werden.",
          );
        }
        return;
      }

      const nextDays = json.days ?? [];
      writeDashboardWeatherForecastCache(location, fromYmd, toYmd, {
        days: nextDays,
      });
      setDays(nextDays);
      hasDataRef.current = nextDays.length > 0;
      setError(null);
    } catch {
      if (requestId !== requestIdRef.current) return;
      if (!hasDataRef.current) {
        setError("Prognose konnte nicht geladen werden.");
      }
    } finally {
      if (requestId === requestIdRef.current && initial) {
        setLoading(false);
      }
    }
  }, [fromYmd, location, toYmd]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  return { days, loading, error, fromYmd, toYmd };
}
