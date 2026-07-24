"use client";

import { getModuleCacheStaleTime } from "@/lib/dashboard/module-data-cache-policy";
import type { ReviewsFeedClientCache } from "@/lib/reviews/reviews-feed-client-cache";

const CACHE_PREFIX = "gwada:reviews-feed:v1:";
const DEFAULT_STALE_MS = getModuleCacheStaleTime("reviewsFeed") ?? 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type ReviewsFeedGoogleLocationSummary = {
  count: number;
  average: number | null;
  median: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  scope: "google_location";
};

export type ReviewsFeedSessionCachePayload = {
  at: number;
  feed: ReviewsFeedClientCache;
  googleLocationSummary: ReviewsFeedGoogleLocationSummary | null;
  googleStatsError: string | null;
};

const memory = new Map<string, ReviewsFeedSessionCachePayload>();

function memoryKey(restaurantId: string, queryKey = "default"): string {
  return `${restaurantId}:${queryKey}`;
}

function storageKey(restaurantId: string, queryKey = "default"): string {
  return `${CACHE_PREFIX}${memoryKey(restaurantId, queryKey)}`;
}

export function peekReviewsFeedSessionCache(
  restaurantId: string,
  queryKey = "default",
  maxAgeMs = MAX_AGE_MS,
): ReviewsFeedSessionCachePayload | null {
  const key = memoryKey(restaurantId, queryKey);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId, queryKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewsFeedSessionCachePayload;
    if (!parsed.feed?.ready) return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeReviewsFeedSessionCache(
  restaurantId: string,
  payload: Omit<ReviewsFeedSessionCachePayload, "at">,
  queryKey = "default",
): void {
  if (!payload.feed.ready) return;
  const entry: ReviewsFeedSessionCachePayload = {
    at: Date.now(),
    ...payload,
  };
  memory.set(memoryKey(restaurantId, queryKey), entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(restaurantId, queryKey),
      JSON.stringify(entry),
    );
  } catch {
    /* quota — Memory reicht für Soft-Nav */
  }
}

export function isReviewsFeedSessionCacheFresh(
  restaurantId: string,
  queryKey = "default",
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekReviewsFeedSessionCache(restaurantId, queryKey);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
