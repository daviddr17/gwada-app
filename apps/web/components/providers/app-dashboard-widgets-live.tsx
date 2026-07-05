"use client";

import { useDashboardWidgetsRealtime } from "@/lib/hooks/use-dashboard-widgets-realtime";

/** App-Zone: Realtime für alle Dashboard-KPI-Widgets (Menu, Kontakte, Bestand, …). */
export function AppDashboardWidgetsLive() {
  useDashboardWidgetsRealtime();
  return null;
}
