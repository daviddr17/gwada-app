"use client";

import { useEffect, useRef } from "react";
import { subscribeDashboardRefreshCoordinator } from "@/lib/dashboard/dashboard-refresh-coordinator";

export const DASHBOARD_WIDGET_POLL_MS = 60_000;

/** Alle Dashboard-Widgets im Hintergrund aktualisieren (ohne Skeleton). */
export const GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT =
  "gwada:dashboard-widgets-refresh";

export function dispatchDashboardWidgetsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT));
}

/**
 * Hält den zentralen Refresh-Coordinator am Leben (Dashboard-Home).
 */
export function useDashboardPageBackgroundRefresh(): void {
  useEffect(() => subscribeDashboardRefreshCoordinator(() => {}), []);
}

/** Erstes Laden zeigt Skeleton; Folgeladungen behalten Zahlen. */
export function useDashboardHasDataRef() {
  return useRef(false);
}
