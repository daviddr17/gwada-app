"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DASHBOARD_WEATHER_CACHE_MAX_AGE_MS } from "@/lib/weather/dashboard-weather-cache";
import {
  peekDisplayWeatherCache,
  peekDisplayWeatherCacheInitial,
  writeDisplayWeatherCache,
  DISPLAY_WEATHER_DEVICE_CACHE_KEY,
  type DisplayWeatherCachePayload,
} from "@/lib/weather/display-weather-cache";
import type { DisplayWeatherSnapshot } from "@/lib/weather/weather-summary";
import { resolveWeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";
import type { WeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";

type DisplayWeatherApiResponse =
  | ({
      available: true;
      restaurant_id: string;
    } & DisplayWeatherSnapshot)
  | { available: false };

export function useDisplayWeatherSummary(
  enabled = true,
  restaurantIdHint?: string | null,
): {
  snapshot: DisplayWeatherSnapshot | null;
  ambienceKind: WeatherAmbienceKind;
  available: boolean;
  loading: boolean;
} {
  const [snapshot, setSnapshot] = useState<DisplayWeatherSnapshot | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cacheKey, setCacheKey] = useState<string | null>(
    restaurantIdHint?.trim() || DISPLAY_WEATHER_DEVICE_CACHE_KEY,
  );
  const hasDataRef = useRef(false);
  const requestIdRef = useRef(0);

  const applyCache = useCallback((cached: DisplayWeatherCachePayload) => {
    setSnapshot(cached.snapshot);
    setAvailable(true);
    setCacheKey(cached.restaurantId);
    hasDataRef.current = true;
    setLoading(false);
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled) return;

      const silent = opts?.silent === true;
      const requestId = ++requestIdRef.current;

      if (!silent && !hasDataRef.current) {
        setLoading(true);
      }

      try {
        const res = await fetch("/api/display/weather", { cache: "no-store" });
        const json = (await res.json()) as DisplayWeatherApiResponse;

        if (requestId !== requestIdRef.current) return;

        if (!res.ok || !json.available) {
          if (!hasDataRef.current) {
            setSnapshot(null);
            setAvailable(false);
          }
          return;
        }

        const next: DisplayWeatherSnapshot = {
          temp: json.temp,
          precipProb: json.precipProb,
          tempMin: json.tempMin,
          tempMax: json.tempMax,
          icon: json.icon,
          conditions: json.conditions,
        };
        writeDisplayWeatherCache(json.restaurant_id, next);
        setCacheKey(json.restaurant_id);
        setSnapshot(next);
        setAvailable(true);
        hasDataRef.current = true;
      } catch {
        if (requestId !== requestIdRef.current) return;
        if (!hasDataRef.current) {
          setSnapshot(null);
          setAvailable(false);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      setAvailable(false);
      setLoading(false);
      hasDataRef.current = false;
      return;
    }

    const cached = peekDisplayWeatherCacheInitial(restaurantIdHint);
    if (cached) {
      applyCache(cached);
      return;
    }

    hasDataRef.current = false;
    void load();
  }, [enabled, restaurantIdHint, applyCache, load]);

  useEffect(() => {
    if (!enabled) return;

    const key = cacheKey ?? DISPLAY_WEATHER_DEVICE_CACHE_KEY;
    const intervalMs = DASHBOARD_WEATHER_CACHE_MAX_AGE_MS;
    const id = window.setInterval(() => {
      const cached = peekDisplayWeatherCache(key, intervalMs);
      if (cached) return;
      void load({ silent: true });
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, cacheKey, load]);

  const ambienceKind = resolveWeatherAmbienceKind({
    icon: snapshot?.icon,
    conditions: snapshot?.conditions,
  });

  return { snapshot, ambienceKind, available, loading };
}
