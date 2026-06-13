"use client";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type {
  DashboardBatchSummary,
  DashboardBatchSummaryErrors,
} from "@/lib/dashboard/load-dashboard-batch-summary-server";
import type { DashboardBatchQueryData } from "@/lib/hooks/use-dashboard-batch-summary-query";

const CACHE_PREFIX = "gwada:dashboard-batch:";
/** Nach 30 Min kein sofortiges Rendern mehr aus dem Speicher. */
export const DASHBOARD_BATCH_CACHE_MAX_AGE_MS = 30 * 60_000;

export type DashboardBatchCachePayload = {
  at: number;
  widgets: string;
  data: DashboardBatchSummary;
  errors: DashboardBatchSummaryErrors;
};

const memory = new Map<string, DashboardBatchCachePayload>();

function widgetsKey(widgets: readonly DashboardBatchWidgetId[]): string {
  return [...widgets].sort().join(",");
}

function memoryKey(restaurantId: string, widgets: readonly DashboardBatchWidgetId[]): string {
  return `${restaurantId}:${widgetsKey(widgets)}`;
}

function storageKey(restaurantId: string, widgets: readonly DashboardBatchWidgetId[]): string {
  return `${CACHE_PREFIX}${restaurantId}:${widgetsKey(widgets)}`;
}

function toQueryData(payload: DashboardBatchCachePayload): DashboardBatchQueryData {
  return { data: payload.data, errors: payload.errors };
}

export function peekDashboardBatchSummaryCache(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
  maxAgeMs = DASHBOARD_BATCH_CACHE_MAX_AGE_MS,
): DashboardBatchQueryData | null {
  const key = memoryKey(restaurantId, widgets);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return toQueryData(fromMemory);
  }

  if (typeof window === "undefined") return fromMemory ? toQueryData(fromMemory) : null;

  try {
    const raw = localStorage.getItem(storageKey(restaurantId, widgets));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardBatchCachePayload;
    if (parsed.widgets !== widgetsKey(widgets)) return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return toQueryData(parsed);
  } catch {
    return fromMemory ? toQueryData(fromMemory) : null;
  }
}

export function writeDashboardBatchSummaryCache(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
  data: DashboardBatchQueryData,
): void {
  const payload: DashboardBatchCachePayload = {
    at: Date.now(),
    widgets: widgetsKey(widgets),
    data: data.data,
    errors: data.errors,
  };
  const key = memoryKey(restaurantId, widgets);
  memory.set(key, payload);

  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(restaurantId, widgets), JSON.stringify(payload));
  } catch {
    /* Quota — Memory-Cache reicht für die Session. */
  }
}

export function clearDashboardBatchSummaryCache(restaurantId?: string): void {
  if (restaurantId) {
    for (const key of [...memory.keys()]) {
      if (key.startsWith(`${restaurantId}:`)) memory.delete(key);
    }
    if (typeof localStorage !== "undefined") {
      const prefix = `${CACHE_PREFIX}${restaurantId}:`;
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) localStorage.removeItem(k);
      }
    }
    return;
  }

  memory.clear();
  if (typeof localStorage === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const k = localStorage.key(i);
    if (k?.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
  }
}
