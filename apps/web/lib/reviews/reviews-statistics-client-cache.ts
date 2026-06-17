"use client";

import type { ReviewStatsPeriod } from "@/lib/reviews/compute-review-statistics";
import type { ReviewStatisticsBundle } from "@/lib/supabase/reviews-analytics-db";

const CACHE_PREFIX = "gwada:reviews-statistics:v2:";
/** Sicherheitsnetz — Invalidierung läuft primär über revision. */
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

export type ReviewStatisticsCachePayload = {
  at: number;
  bundle: ReviewStatisticsBundle;
};

const memory = new Map<string, ReviewStatisticsCachePayload>();

function memoryKey(restaurantId: string, monthsBack: ReviewStatsPeriod): string {
  return `${restaurantId}:${monthsBack}`;
}

function storageKey(
  restaurantId: string,
  monthsBack: ReviewStatsPeriod,
): string {
  return `${CACHE_PREFIX}${restaurantId}:${monthsBack}`;
}

export function peekReviewStatisticsCache(
  restaurantId: string,
  monthsBack: ReviewStatsPeriod,
  maxAgeMs = MAX_AGE_MS,
): ReviewStatisticsBundle | null {
  const key = memoryKey(restaurantId, monthsBack);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory.bundle;
  }

  if (typeof window === "undefined") return fromMemory?.bundle ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId, monthsBack));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewStatisticsCachePayload;
    if (!parsed.bundle?.revision || !parsed.bundle?.stats) return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed.bundle;
  } catch {
    return fromMemory?.bundle ?? null;
  }
}

export function writeReviewStatisticsCache(
  restaurantId: string,
  monthsBack: ReviewStatsPeriod,
  bundle: ReviewStatisticsBundle,
): void {
  const entry: ReviewStatisticsCachePayload = {
    at: Date.now(),
    bundle,
  };
  memory.set(memoryKey(restaurantId, monthsBack), entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(restaurantId, monthsBack),
      JSON.stringify(entry),
    );
  } catch {
    /* quota */
  }
}

export function mergeReviewStatisticsSyncMeta(
  bundle: ReviewStatisticsBundle,
  sync: ReviewStatisticsBundle["sync"],
): ReviewStatisticsBundle {
  if (
    bundle.sync.google.syncedAt === sync.google.syncedAt &&
    bundle.sync.facebook.syncedAt === sync.facebook.syncedAt &&
    bundle.sync.google.stale === sync.google.stale &&
    bundle.sync.facebook.stale === sync.facebook.stale &&
    bundle.sync.syncTriggered === sync.syncTriggered
  ) {
    return bundle;
  }
  return { ...bundle, sync };
}
