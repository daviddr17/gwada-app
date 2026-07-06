"use client";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { getModuleCacheStaleTime } from "@/lib/dashboard/module-data-cache-policy";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import type { GoogleReviewsPaginationMeta } from "@/lib/reviews/google-reviews-pagination";
import type {
  MergedReviewsPaginationMeta,
  ReviewListPaginationMeta,
} from "@/lib/reviews/reviews-list-pagination";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

const CACHE_PREFIX = "gwada:reviews-feed:v1:";
const DEFAULT_STALE_MS = getModuleCacheStaleTime("reviewsFeed") ?? 60_000;
/** Hard discard — danach kein sofortiges Rendern mehr aus dem Speicher. */
const MAX_AGE_MS = 30 * 60_000;

export type ReviewsFeedGoogleLocationSummary = {
  count: number;
  average: number | null;
  median: null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  scope: "google_location";
};

export type ReviewsFeedSessionCachePayload = {
  at: number;
  feedCache: ReviewsFeedClientCache;
  googleLocationSummary: ReviewsFeedGoogleLocationSummary | null;
};

const memory = new Map<string, ReviewsFeedSessionCachePayload>();

function memoryKey(restaurantId: string): string {
  return restaurantId;
}

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekReviewsFeedSessionCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): ReviewsFeedSessionCachePayload | null {
  const key = memoryKey(restaurantId);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewsFeedSessionCachePayload;
    if (!parsed.feedCache?.ready) return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeReviewsFeedSessionCache(
  restaurantId: string,
  feedCache: ReviewsFeedClientCache,
  googleLocationSummary: ReviewsFeedGoogleLocationSummary | null,
): void {
  const payload: ReviewsFeedSessionCachePayload = {
    at: Date.now(),
    feedCache,
    googleLocationSummary,
  };
  memory.set(memoryKey(restaurantId), payload);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function isReviewsFeedSessionCacheFresh(
  restaurantId: string,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekReviewsFeedSessionCache(restaurantId);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}

export function clearReviewsFeedSessionCache(restaurantId?: string): void {
  if (restaurantId) {
    memory.delete(memoryKey(restaurantId));
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(storageKey(restaurantId));
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

export type ReviewsFeedPageMap = Record<number, UnifiedReview[]>;

export type ReviewsFeedClientCache = {
  ready: boolean;
  gwada: UnifiedReview[];
  allPages: ReviewsFeedPageMap;
  allPagination: MergedReviewsPaginationMeta | null;
  allTokenByPage: Record<number, string>;
  googlePages: ReviewsFeedPageMap;
  googlePagination: GoogleReviewsPaginationMeta | null;
  googleTokenByPage: Record<number, string>;
  facebookPages: ReviewsFeedPageMap;
  facebookPagination: ReviewListPaginationMeta | null;
  facebookTokenByPage: Record<number, string>;
  platformTotals: Partial<Record<ReviewPlatform, number>>;
  loadErrors: Partial<Record<ReviewPlatform, string>>;
  sync: ReviewsFeedSyncMeta | null;
};

export function createEmptyReviewsFeedClientCache(): ReviewsFeedClientCache {
  return {
    ready: false,
    gwada: [],
    allPages: {},
    allPagination: null,
    allTokenByPage: {},
    googlePages: {},
    googlePagination: null,
    googleTokenByPage: {},
    facebookPages: {},
    facebookPagination: null,
    facebookTokenByPage: {},
    platformTotals: {},
    loadErrors: {},
    sync: null,
  };
}

export function patchReviewInFeedCache(
  cache: ReviewsFeedClientCache,
  review: UnifiedReview,
  patch: Partial<UnifiedReview>,
): ReviewsFeedClientCache {
  const key = `${review.platform}:${review.id}`;
  const patchList = (items: UnifiedReview[]) =>
    items.map((item) =>
      `${item.platform}:${item.id}` === key ? { ...item, ...patch } : item,
    );
  const patchPages = (pages: ReviewsFeedPageMap) => {
    const next: ReviewsFeedPageMap = {};
    for (const [page, items] of Object.entries(pages)) {
      next[Number(page)] = patchList(items);
    }
    return next;
  };

  return {
    ...cache,
    gwada: review.platform === "gwada" ? patchList(cache.gwada) : cache.gwada,
    allPages: patchPages(cache.allPages),
    googlePages: patchPages(cache.googlePages),
    facebookPages: patchPages(cache.facebookPages),
  };
}

export function markReviewsReadInFeedCache(
  cache: ReviewsFeedClientCache,
  reviews: UnifiedReview[],
): ReviewsFeedClientCache {
  if (reviews.length === 0) return cache;
  let next = cache;
  for (const review of reviews) {
    next = patchReviewInFeedCache(next, review, { isUnread: false });
  }
  return next;
}
