"use client";

import { useMemo } from "react";
import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import { visibleDashboardBatchWidgets } from "@/lib/dashboard/dashboard-batch-widgets";
import {
  effectiveDashboardShortcutVisibility,
  effectiveDashboardWidgetVisibility,
  hasDashboardShortcutAccess,
  hasDashboardWidgetAccess,
  type DashboardWidgetAccessOptions,
} from "@/lib/permissions/dashboard-widget-permissions";
import type { DashboardShortcutId } from "@/lib/constants/dashboard-shortcuts";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { usePlatformWeatherAvailable } from "@/lib/hooks/use-platform-weather-available";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";

/**
 * Widget-/Shortcut-Sichtbarkeit ∩ Modul-Lese-Rechte (wie Sidebar).
 * Wetter nur bei Superadmin-Freigabe + API-Key.
 */
export function useDashboardEffectiveWidgetPrefs() {
  const mounted = useClientMounted();
  const prefs = useDashboardWidgetPreferences();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const { available: weatherAvailable, loading: weatherLoading } =
    usePlatformWeatherAvailable();

  const accessOptions = useMemo<DashboardWidgetAccessOptions>(
    () => ({
      permissionsLoading: !mounted || permissionsLoading,
      weatherAvailable,
      weatherLoading: !mounted || weatherLoading,
    }),
    [mounted, permissionsLoading, weatherAvailable, weatherLoading],
  );

  const visibility = useMemo(
    () =>
      effectiveDashboardWidgetVisibility(
        prefs.visibility,
        has,
        accessOptions,
      ),
    [prefs.visibility, has, accessOptions],
  );

  const shortcuts = useMemo(
    () => ({
      ...prefs.shortcuts,
      visibility: mounted
        ? effectiveDashboardShortcutVisibility(
            prefs.shortcuts.visibility,
            has,
            permissionsLoading,
          )
        : prefs.shortcuts.visibility,
    }),
    [mounted, prefs.shortcuts, has, permissionsLoading],
  );

  const batchWidgets = useMemo(
    () => visibleDashboardBatchWidgets(visibility),
    [visibility],
  );

  const permittedWidgetIds = useMemo(
    () =>
      (Object.keys(visibility) as DashboardWidgetId[]).filter((id) =>
        hasDashboardWidgetAccess(has, id, accessOptions),
      ),
    [visibility, has, accessOptions],
  );

  const permittedShortcutIds = useMemo(
    () =>
      mounted
        ? (Object.keys(shortcuts.visibility) as DashboardShortcutId[]).filter(
            (id) => permissionsLoading || hasDashboardShortcutAccess(has, id),
          )
        : (Object.keys(prefs.shortcuts.visibility) as DashboardShortcutId[]),
    [mounted, shortcuts.visibility, prefs.shortcuts.visibility, has, permissionsLoading],
  );

  return {
    ...prefs,
    visibility,
    shortcuts,
    batchWidgets,
    permittedWidgetIds,
    permittedShortcutIds,
    permissionsLoading,
    weatherAvailable,
    weatherLoading,
  };
}
