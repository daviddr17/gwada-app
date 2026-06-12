"use client";

import { useEffect } from "react";
import {
  DASHBOARD_WIDGET_POLL_MS,
  GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT,
  dispatchDashboardWidgetsRefresh,
} from "@/lib/dashboard/dashboard-widget-refresh";

let pollSubscribers = 0;
let pollIntervalId: number | null = null;

function ensurePollInterval(): void {
  if (pollIntervalId != null || typeof window === "undefined") return;
  pollIntervalId = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    dispatchDashboardWidgetsRefresh();
  }, DASHBOARD_WIDGET_POLL_MS);
}

function releasePollInterval(): void {
  if (pollSubscribers > 0 || pollIntervalId == null) return;
  window.clearInterval(pollIntervalId);
  pollIntervalId = null;
}

/** Ein zentraler 60s-Timer statt mehrerer paralleler Intervalle. */
export function subscribeDashboardRefreshCoordinator(
  onRefresh: () => void,
): () => void {
  pollSubscribers += 1;
  ensurePollInterval();

  const handler = () => onRefresh();
  window.addEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, handler);

  return () => {
    window.removeEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, handler);
    pollSubscribers = Math.max(0, pollSubscribers - 1);
    releasePollInterval();
  };
}

export function useDashboardRefreshSubscription(onRefresh: () => void): void {
  useEffect(() => subscribeDashboardRefreshCoordinator(onRefresh), [onRefresh]);
}
