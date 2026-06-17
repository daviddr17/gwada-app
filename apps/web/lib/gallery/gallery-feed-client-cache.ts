"use client";

import { GALLERY_FILTER_ALL } from "@/lib/constants/gallery-platforms";
import type { GalleryFeedSyncMeta } from "@/lib/gallery/gallery-feed-sync-meta";
import type {
  GalleryCategoryOption,
  UnifiedGalleryHighlight,
  UnifiedGalleryItem,
} from "@/lib/gallery/unified-gallery-item";

const CACHE_PREFIX = "gwada:gallery-feed:";
const DEFAULT_STALE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type GalleryFeedCachePayload = {
  at: number;
  items: UnifiedGalleryItem[];
  highlights: UnifiedGalleryHighlight[];
  categories: GalleryCategoryOption[];
  sync: GalleryFeedSyncMeta | null;
};

const memory = new Map<string, GalleryFeedCachePayload>();

function memoryKey(restaurantId: string): string {
  return `${restaurantId}:${GALLERY_FILTER_ALL}`;
}

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}:${GALLERY_FILTER_ALL}`;
}

export function peekGalleryFeedCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): GalleryFeedCachePayload | null {
  const key = memoryKey(restaurantId);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GalleryFeedCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeGalleryFeedCache(
  restaurantId: string,
  payload: Omit<GalleryFeedCachePayload, "at">,
): void {
  const entry: GalleryFeedCachePayload = { at: Date.now(), ...payload };
  memory.set(memoryKey(restaurantId), entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function isGalleryFeedClientCacheFresh(
  restaurantId: string,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekGalleryFeedCache(restaurantId);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
