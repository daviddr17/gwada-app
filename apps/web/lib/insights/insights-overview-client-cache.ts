"use client";

import type {
  InsightsStatisticsResult,
  InsightsStatsDays,
  InsightsStatsPeriod,
} from "@/lib/insights/compute-insights-statistics";

const CACHE_PREFIX = "gwada:insights-overview:";
const DEFAULT_STALE_MS = 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type InsightsPeriodCacheKey =
  | { mode: "months"; value: InsightsStatsPeriod }
  | { mode: "days"; value: InsightsStatsDays };

export type InsightsOverviewCachePayload = {
  at: number;
  data: InsightsStatisticsResult;
};

const memory = new Map<string, InsightsOverviewCachePayload>();

function memoryKey(
  restaurantId: string,
  period: InsightsPeriodCacheKey,
): string {
  return `${restaurantId}:${period.mode}:${period.value}`;
}

function storageKey(
  restaurantId: string,
  period: InsightsPeriodCacheKey,
): string {
  return `${CACHE_PREFIX}${memoryKey(restaurantId, period)}`;
}

export function peekInsightsOverviewCache(
  restaurantId: string,
  period: InsightsPeriodCacheKey,
  maxAgeMs = MAX_AGE_MS,
): InsightsOverviewCachePayload | null {
  const key = memoryKey(restaurantId, period);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId, period));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InsightsOverviewCachePayload;
    if (!parsed.data?.periodStartYmd) return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeInsightsOverviewCache(
  restaurantId: string,
  period: InsightsPeriodCacheKey,
  data: InsightsStatisticsResult,
): void {
  const entry: InsightsOverviewCachePayload = { at: Date.now(), data };
  memory.set(memoryKey(restaurantId, period), entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(restaurantId, period),
      JSON.stringify(entry),
    );
  } catch {
    /* quota */
  }
}

export function isInsightsOverviewCacheFresh(
  restaurantId: string,
  period: InsightsPeriodCacheKey,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekInsightsOverviewCache(restaurantId, period);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
