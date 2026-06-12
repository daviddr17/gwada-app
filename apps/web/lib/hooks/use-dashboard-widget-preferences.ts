"use client";

import { useContext } from "react";
import {
  DashboardWidgetPreferencesContext,
  type DashboardWidgetPreferencesValue,
} from "@/lib/contexts/dashboard-widget-preferences-context";

export type { DashboardWidgetPrefs } from "@/lib/constants/dashboard-widgets";

export type UseDashboardWidgetPreferencesResult = Omit<
  DashboardWidgetPreferencesValue,
  "isReconciled"
>;

function stripReconciled(
  value: DashboardWidgetPreferencesValue,
): UseDashboardWidgetPreferencesResult {
  const { isReconciled: _isReconciled, ...rest } = value;
  return rest;
}

/** Liest Widget-Prefs aus dem App-weiten Provider (eine Instanz, kein Doppel-Fetch). */
export function useDashboardWidgetPreferences(): UseDashboardWidgetPreferencesResult {
  const ctx = useContext(DashboardWidgetPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useDashboardWidgetPreferences erfordert DashboardWidgetPreferencesProvider.",
    );
  }
  return stripReconciled(ctx);
}
