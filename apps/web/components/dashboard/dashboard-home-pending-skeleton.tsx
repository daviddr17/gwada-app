"use client";

import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";
import {
  dashboardWidgetMasonryClassName,
  dashboardWidgetMasonryItemClassName,
  dashboardWidgetMasonryLaneClassName,
  dashboardWidgetMasonryMobileStackClassName,
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
      <div className={dashboardWidgetMasonryMobileStackClassName}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={dashboardWidgetMasonryItemClassName(1)}>
            <DashboardWidgetTileSkeleton />
          </div>
        ))}
      </div>
      <div className={dashboardWidgetMasonryClassName}>
        <div className={dashboardWidgetMasonryLaneClassName}>
          {[0, 2].map((i) => (
            <div key={i} className={dashboardWidgetMasonryItemClassName(1)}>
              <DashboardWidgetTileSkeleton />
            </div>
          ))}
        </div>
        <div className={dashboardWidgetMasonryLaneClassName}>
          {[1, 3].map((i) => (
            <div key={i} className={dashboardWidgetMasonryItemClassName(1)}>
              <DashboardWidgetTileSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
