"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { DashboardCompactMetricsSkeleton } from "@/components/dashboard/dashboard-compact-list";
import { dashboardWidgetSoftElevationClassName } from "@/lib/ui/dashboard-widget-polish";
import { cn } from "@/lib/utils";

export function DashboardWidgetTileSkeleton() {
  return (
    <SkeletonCardFrame
      className={cn("min-w-0", dashboardWidgetSoftElevationClassName)}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="px-4 pb-4">
        <DashboardCompactMetricsSkeleton count={3} />
      </div>
    </SkeletonCardFrame>
  );
}
