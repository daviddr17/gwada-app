"use client";

import { getModuleCacheStaleTime } from "@/lib/dashboard/module-data-cache-policy";

const CACHE_PREFIX = "gwada:review-platform-connections:";
const DEFAULT_TTL_MS = getModuleCacheStaleTime("channelConnections") ?? 90_000;

export type CachedReviewPlatformConnections = {
  googleConnected: boolean;
  facebookConnected: boolean;
  googleVisible: boolean;
  facebookVisible: boolean;
};

type CachedPayload = {
  at: number;
  data: CachedReviewPlatformConnections;
};

function cacheKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekReviewPlatformConnectionsCache(
  restaurantId: string,
  maxAgeMs = DEFAULT_TTL_MS,
): CachedReviewPlatformConnections | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeReviewPlatformConnectionsCache(
  restaurantId: string,
  data: CachedReviewPlatformConnections,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedPayload = { at: Date.now(), data };
    sessionStorage.setItem(cacheKey(restaurantId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function isReviewPlatformConnectionsCacheFresh(
  restaurantId: string,
  staleMs = DEFAULT_TTL_MS,
): boolean {
  return peekReviewPlatformConnectionsCache(restaurantId, staleMs) != null;
}
