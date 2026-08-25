"use client";

import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";
import {
  dashboardWidgetMasonryClassName,
  dashboardWidgetMasonryItemClassName,
  dashboardWidgetStackClassName,
} from "@/lib/ui/dashboard-widget-masonry";

/** Soft-Nav / Prefs-Pending — gleiches Raster wie die Dashboard-Home. */
export function DashboardHomePendingSkeleton() {
  return (
    <div
      className={dashboardWidgetStackClassName}
      aria-busy="true"
      aria-label="Dashboard wird geladen"
    >
      <div className={dashboardWidgetMasonryClassName}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={dashboardWidgetMasonryItemClassName(1)}>
            <DashboardWidgetTileSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
