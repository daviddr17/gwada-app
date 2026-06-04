"use client";

import { useEffect, useRef } from "react";

export const DASHBOARD_WIDGET_POLL_MS = 60_000;

/** Alle Dashboard-Widgets im Hintergrund aktualisieren (ohne Skeleton). */
export const GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT =
  "gwada:dashboard-widgets-refresh";

export function dispatchDashboardWidgetsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT));
}

/**
 * 60 s Polling nur bei sichtbarem Browser-Tab — kein Reload beim Tab-Wechsel.
 */
export function useDashboardPageBackgroundRefresh(): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      dispatchDashboardWidgetsRefresh();
    }, DASHBOARD_WIDGET_POLL_MS);

    return () => window.clearInterval(id);
  }, []);
}

/** Erstes Laden zeigt Skeleton; Folgeladungen behalten Zahlen. */
export function useDashboardHasDataRef() {
  return useRef(false);
}
