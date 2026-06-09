"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  parseShiftPlanWeatherByDate,
  type ShiftPlanDayWeather,
} from "@/lib/weather/shift-plan-day-weather";
import { buildVisualCrossingLocation } from "@/lib/weather/visual-crossing-location";
import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";

type WeatherApiError =
  | { error: "missing_api_key" }
  | { error: "invalid_location" }
  | { error: "invalid_date_range" }
  | { error: "date_range_too_long" }
  | { error: "fetch_failed" }
  | { error: "upstream_error"; status?: number };

export function useShiftPlanWeatherByDate(
  dayKeys: readonly string[],
  enabled = true,
): {
  weatherByDate: ReadonlyMap<string, ShiftPlanDayWeather>;
  weatherLoading: boolean;
} {
  const { profile, isReady: profileReady } = useRestaurantProfile();
  const location = useMemo(() => buildVisualCrossingLocation(profile), [profile]);
  const [weatherByDate, setWeatherByDate] = useState<
    Map<string, ShiftPlanDayWeather>
  >(() => new Map());
  const [weatherLoading, setWeatherLoading] = useState(false);
  const requestIdRef = useRef(0);

  const from = dayKeys[0] ?? "";
  const to = dayKeys[dayKeys.length - 1] ?? "";
  const dayKeysKey = dayKeys.join(",");

  const load = useCallback(async () => {
    if (!enabled || !profileReady || dayKeys.length === 0 || !from || !to) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setWeatherLoading(true);

    try {
      const u = new URL("/api/weather", window.location.origin);
      u.searchParams.set("location", location);
      u.searchParams.set("from", from);
      u.searchParams.set("to", to);
      const res = await fetch(u.toString());
      const json = (await res.json()) as
        | VisualCrossingTimelineResponse
        | WeatherApiError;

      if (requestId !== requestIdRef.current) return;

      if (!res.ok || "error" in json) {
        setWeatherByDate(new Map());
        return;
      }

      setWeatherByDate(parseShiftPlanWeatherByDate(json));
    } catch {
      if (requestId !== requestIdRef.current) return;
      setWeatherByDate(new Map());
    } finally {
      if (requestId === requestIdRef.current) {
        setWeatherLoading(false);
      }
    }
  }, [dayKeys.length, enabled, from, location, profileReady, to]);

  useEffect(() => {
    void load();
  }, [load, dayKeysKey]);

  return { weatherByDate, weatherLoading };
}
