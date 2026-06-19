"use client";

import { EVENTS_FILTER_ALL } from "@/lib/constants/events-platforms";
import type { EventsFeedSyncMeta } from "@/lib/events/events-feed-sync-meta";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";

const CACHE_PREFIX = "gwada:events-feed:";
const DEFAULT_STALE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type EventsFeedCachePayload = {
  at: number;
  items: UnifiedEventItem[];
  sync: EventsFeedSyncMeta | null;
};

const memory = new Map<string, EventsFeedCachePayload>();

function memoryKey(restaurantId: string): string {
  return `${restaurantId}:${EVENTS_FILTER_ALL}`;
}

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}:${EVENTS_FILTER_ALL}`;
}

export function peekEventsFeedCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): EventsFeedCachePayload | null {
  const key = memoryKey(restaurantId);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EventsFeedCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeEventsFeedCache(
  restaurantId: string,
  payload: Omit<EventsFeedCachePayload, "at">,
): void {
  const entry: EventsFeedCachePayload = { at: Date.now(), ...payload };
  memory.set(memoryKey(restaurantId), entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}
