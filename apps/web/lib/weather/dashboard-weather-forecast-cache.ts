"use client";

import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";
import { DASHBOARD_WEATHER_CACHE_MAX_AGE_MS } from "@/lib/weather/dashboard-weather-cache";

const CACHE_PREFIX = "gwada:dashboard-weather-forecast:";

export const DASHBOARD_WEATHER_FORECAST_DAYS = 7;

type ForecastCachePayload = {
  at: number;
  location: string;
  from: string;
  to: string;
  data: VisualCrossingTimelineResponse;
};

const memory = new Map<string, ForecastCachePayload>();

export function dashboardWeatherForecastCacheKey(
  location: string,
  from: string,
  to: string,
): string {
  return `${location.trim()}|${from}|${to}`;
}

function storageKey(cacheKey: string): string {
  return `${CACHE_PREFIX}${encodeURIComponent(cacheKey)}`;
}

export function peekDashboardWeatherForecastCache(
  location: string,
  from: string,
  to: string,
  maxAgeMs = DASHBOARD_WEATHER_CACHE_MAX_AGE_MS,
): VisualCrossingTimelineResponse | null {
  const cacheKey = dashboardWeatherForecastCacheKey(location, from, to);
  if (!location.trim() || !from || !to) return null;

  const fromMemory = memory.get(cacheKey);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory.data;
  }

  if (typeof window === "undefined") {
    return fromMemory?.data ?? null;
  }

  try {
    const raw = localStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ForecastCachePayload;
    if (parsed.location !== location || parsed.from !== from || parsed.to !== to) {
      return null;
    }
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(cacheKey, parsed);
    return parsed.data;
  } catch {
    return fromMemory?.data ?? null;
  }
}

export function writeDashboardWeatherForecastCache(
  location: string,
  from: string,
  to: string,
  data: VisualCrossingTimelineResponse,
): void {
  const cacheKey = dashboardWeatherForecastCacheKey(location, from, to);
  if (!location.trim() || !from || !to) return;

  const payload: ForecastCachePayload = {
    at: Date.now(),
    location,
    from,
    to,
    data,
  };
  memory.set(cacheKey, payload);

  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(cacheKey), JSON.stringify(payload));
  } catch {
    /* Quota — Memory-Cache reicht für die Session. */
  }
}
