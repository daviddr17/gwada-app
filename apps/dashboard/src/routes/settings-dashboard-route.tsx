"use client";

import { DashboardShortcutsPanel } from "@/components/settings/dashboard-shortcuts-panel";
import { DashboardWidgetsPanel } from "@/components/settings/dashboard-widgets-panel";

/** SPA-Route: Einstellungen → Dashboard (Widgets + Schnellaktionen). */
export function SettingsDashboardRoute() {
  return (
    <div className="space-y-6">
      <DashboardWidgetsPanel />
      <DashboardShortcutsPanel />
    </div>
  );
}
