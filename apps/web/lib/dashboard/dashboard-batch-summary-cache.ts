"use client";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type {
  DashboardBatchSummary,
  DashboardBatchSummaryErrors,
} from "@/lib/dashboard/load-dashboard-batch-summary-server";
import type { DashboardBatchQueryData } from "@/lib/hooks/use-dashboard-batch-summary-query";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

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

function isFreshPayload(
  payload: DashboardBatchCachePayload,
  maxAgeMs: number,
): boolean {
  return Date.now() - payload.at <= maxAgeMs;
}

/** Neueste gültige Batch-Payload fürs Restaurant (Widget-Set darf abweichen). */
function peekAnyDashboardBatchSummaryCache(
  restaurantId: string,
  maxAgeMs: number,
): DashboardBatchQueryData | null {
  let best: DashboardBatchCachePayload | null = null;

  for (const [key, payload] of memory) {
    if (!key.startsWith(`${restaurantId}:`)) continue;
    if (!isFreshPayload(payload, maxAgeMs)) continue;
    if (!best || payload.at > best.at) best = payload;
  }

  if (typeof window !== "undefined") {
    try {
      const prefix = `${CACHE_PREFIX}${restaurantId}:`;
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (!k?.startsWith(prefix)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as DashboardBatchCachePayload;
        if (!isFreshPayload(parsed, maxAgeMs)) continue;
        memory.set(`${restaurantId}:${parsed.widgets}`, parsed);
        if (!best || parsed.at > best.at) best = parsed;
      }
    } catch {
      /* ignore */
    }
  }

  return best ? toQueryData(best) : null;
}

export function peekDashboardBatchSummaryCache(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
  maxAgeMs = DASHBOARD_BATCH_CACHE_MAX_AGE_MS,
): DashboardBatchQueryData | null {
  const key = memoryKey(restaurantId, widgets);
  const fromMemory = memory.get(key);
  if (fromMemory && isFreshPayload(fromMemory, maxAgeMs)) {
    return toQueryData(fromMemory);
  }

  if (typeof window === "undefined") {
    return fromMemory && isFreshPayload(fromMemory, maxAgeMs)
      ? toQueryData(fromMemory)
      : peekAnyDashboardBatchSummaryCache(restaurantId, maxAgeMs);
  }

  try {
    const raw = localStorage.getItem(storageKey(restaurantId, widgets));
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardBatchCachePayload;
      if (
        parsed.widgets === widgetsKey(widgets) &&
        isFreshPayload(parsed, maxAgeMs)
      ) {
        memory.set(key, parsed);
        return toQueryData(parsed);
      }
    }
  } catch {
    /* fall through */
  }

  // Widget-Key wechselt oft während Permissions laden — trotzdem KPIs sofort zeigen.
  return peekAnyDashboardBatchSummaryCache(restaurantId, maxAgeMs);
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
  // JSON.stringify + setItem vom Main-Thread weg — sonst Stocken nach Batch-Fetch.
  const persistKey = storageKey(restaurantId, widgets);
  runWhenIdle(() => {
    try {
      const latest = memory.get(key);
      if (!latest || latest.at !== payload.at) return;
      localStorage.setItem(persistKey, JSON.stringify(latest));
    } catch {
      /* Quota — Memory-Cache reicht für die Session. */
    }
  }, 2_000);
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
