"use client";

import type { NewsPlatformFilter } from "@/lib/constants/news-platforms";
import { getModuleCacheStaleTime } from "@/lib/dashboard/module-data-cache-policy";
import type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";

const CACHE_PREFIX = "gwada:news-feed:";
const DEFAULT_STALE_MS = getModuleCacheStaleTime("newsFeed") ?? 5 * 60_000;
/** Hard discard — danach kein sofortiges Rendern mehr aus dem Speicher. */
const MAX_AGE_MS = 30 * 60_000;

export type NewsFeedCachePayload = {
  at: number;
  items: UnifiedNewsItem[];
  sync: NewsFeedSyncMeta | null;
};

const memory = new Map<string, NewsFeedCachePayload>();

function memoryKey(restaurantId: string, platform: NewsPlatformFilter): string {
  return `${restaurantId}:${platform}`;
}

function storageKey(restaurantId: string, platform: NewsPlatformFilter): string {
  return `${CACHE_PREFIX}${restaurantId}:${platform}`;
}

export function peekNewsFeedCache(
  restaurantId: string,
  platform: NewsPlatformFilter,
  maxAgeMs = MAX_AGE_MS,
): NewsFeedCachePayload | null {
  const key = memoryKey(restaurantId, platform);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId, platform));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsFeedCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeNewsFeedCache(
  restaurantId: string,
  platform: NewsPlatformFilter,
  items: UnifiedNewsItem[],
  sync: NewsFeedSyncMeta | null,
): void {
  const payload: NewsFeedCachePayload = { at: Date.now(), items, sync };
  memory.set(memoryKey(restaurantId, platform), payload);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(restaurantId, platform),
      JSON.stringify(payload),
    );
  } catch {
    /* quota */
  }
}

export function clearNewsFeedCache(restaurantId?: string): void {
  if (restaurantId) {
    for (const key of memory.keys()) {
      if (key.startsWith(`${restaurantId}:`)) memory.delete(key);
    }
    if (typeof window !== "undefined") {
      for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(`${CACHE_PREFIX}${restaurantId}:`)) {
          sessionStorage.removeItem(key);
        }
      }
    }
    return;
  }

  memory.clear();
  if (typeof window === "undefined") return;
  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
  }
}

export function isNewsFeedClientCacheFresh(
  restaurantId: string,
  platform: NewsPlatformFilter,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekNewsFeedCache(restaurantId, platform);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
