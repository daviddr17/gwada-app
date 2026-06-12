import {
  getModuleCacheGcTime,
  getModuleCachePollInterval,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";

/** Werte aus `module-data-cache-policy.ts` → dashboardSummaries */
export const DASHBOARD_SUMMARY_STALE_MS =
  getModuleCacheStaleTime("dashboardSummaries") ?? 30_000;
export const DASHBOARD_SUMMARY_REFETCH_MS =
  getModuleCachePollInterval("dashboardSummaries") ?? 60_000;
export const DASHBOARD_SUMMARY_GC_MS =
  getModuleCacheGcTime("dashboardSummaries") ?? 5 * 60_000;

export const NOTIFICATION_SUMMARY_STALE_MS =
  getModuleCacheStaleTime("notificationBell") ?? 30_000;
export const NOTIFICATION_SUMMARY_REFETCH_MS =
  getModuleCachePollInterval("notificationBell") ?? 60_000;
export const NOTIFICATION_SUMMARY_GC_MS =
  getModuleCacheGcTime("notificationBell") ?? 5 * 60_000;
