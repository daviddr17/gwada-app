"use client";

import type { DisplayWeatherSnapshot } from "@/lib/weather/weather-summary";
import { DASHBOARD_WEATHER_CACHE_MAX_AGE_MS } from "@/lib/weather/dashboard-weather-cache";

const CACHE_PREFIX = "gwada:display-weather:";
/** Ein gepairtes Tablet = ein Restaurant — Cache ohne bekannte UUID. */
export const DISPLAY_WEATHER_DEVICE_CACHE_KEY = "__device__";

export type DisplayWeatherCachePayload = {
  at: number;
  restaurantId: string;
  snapshot: DisplayWeatherSnapshot;
};

const memory = new Map<string, DisplayWeatherCachePayload>();

function storageKey(cacheKey: string): string {
  return `${CACHE_PREFIX}${cacheKey}`;
}

export function peekDisplayWeatherCache(
  cacheKey: string,
  maxAgeMs = DASHBOARD_WEATHER_CACHE_MAX_AGE_MS,
): DisplayWeatherCachePayload | null {
  if (!cacheKey.trim()) return null;

  const fromMemory = memory.get(cacheKey);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") {
    return fromMemory ?? null;
  }

  try {
    const raw = localStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DisplayWeatherCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(cacheKey, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeDisplayWeatherCache(
  restaurantId: string,
  snapshot: DisplayWeatherSnapshot,
): void {
  if (!restaurantId.trim()) return;

  const payload: DisplayWeatherCachePayload = {
    at: Date.now(),
    restaurantId,
    snapshot,
  };

  for (const key of [restaurantId, DISPLAY_WEATHER_DEVICE_CACHE_KEY]) {
    memory.set(key, payload);
    if (typeof localStorage === "undefined") continue;
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(payload));
    } catch {
      /* Quota — Memory-Cache reicht für die Session. */
    }
  }
}

export function peekDisplayWeatherCacheInitial(
  restaurantId?: string | null,
): DisplayWeatherCachePayload | null {
  if (restaurantId?.trim()) {
    const byRestaurant = peekDisplayWeatherCache(restaurantId);
    if (byRestaurant) return byRestaurant;
  }
  return peekDisplayWeatherCache(DISPLAY_WEATHER_DEVICE_CACHE_KEY);
}
