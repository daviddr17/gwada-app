"use client";

import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";

/** Soft-Nav / Prefs-Pending — gleiches Raster wie die Dashboard-Home. */
export function DashboardHomePendingSkeleton() {
  return (
    <div
      className="grid items-stretch gap-4 pt-2 lg:grid-cols-2"
      aria-busy="true"
      aria-label="Dashboard wird geladen"
    >
      <DashboardWidgetTileSkeleton />
      <DashboardWidgetTileSkeleton />
      <DashboardWidgetTileSkeleton />
      <DashboardWidgetTileSkeleton />
    </div>
  );
}
