"use client";

import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";

const CACHE_PREFIX = "gwada:dashboard-weather:";
/** Anzeige aus Cache; danach still nachladen (wie Batch-KPIs). */
export const DASHBOARD_WEATHER_CACHE_MAX_AGE_MS = 15 * 60_000;

type WeatherCachePayload = {
  at: number;
  location: string;
  data: VisualCrossingTimelineResponse;
};

const memory = new Map<string, WeatherCachePayload>();

function storageKey(location: string): string {
  return `${CACHE_PREFIX}${encodeURIComponent(location)}`;
}

export function peekDashboardWeatherCache(
  location: string,
  maxAgeMs = DASHBOARD_WEATHER_CACHE_MAX_AGE_MS,
): VisualCrossingTimelineResponse | null {
  if (!location.trim()) return null;

  const fromMemory = memory.get(location);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory.data;
  }

  if (typeof window === "undefined") {
    return fromMemory?.data ?? null;
  }

  try {
    const raw = localStorage.getItem(storageKey(location));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherCachePayload;
    if (parsed.location !== location) return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(location, parsed);
    return parsed.data;
  } catch {
    return fromMemory?.data ?? null;
  }
}

export function writeDashboardWeatherCache(
  location: string,
  data: VisualCrossingTimelineResponse,
): void {
  if (!location.trim()) return;

  const payload: WeatherCachePayload = {
    at: Date.now(),
    location,
    data,
  };
  memory.set(location, payload);

  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(location), JSON.stringify(payload));
  } catch {
    /* Quota — Memory-Cache reicht für die Session. */
  }
}
