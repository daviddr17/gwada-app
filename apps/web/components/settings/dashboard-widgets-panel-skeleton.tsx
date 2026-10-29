"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function DashboardWidgetsPanelSkeleton() {
  return (
    <SkeletonCardFrame className="shadow-card">
      <div className="space-y-1.5 border-b border-border/30 pb-3">
        <Skeleton className="h-5 w-36 max-w-full rounded-md" />
        <Skeleton className="h-3.5 w-full max-w-xl rounded-md" />
      </div>
      <div className="space-y-1 pt-3">
        <Skeleton className="mb-1 h-3 w-24 max-w-md rounded-md" />
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/15 py-1 pe-2.5 ps-1"
          >
            <Skeleton className="size-7 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1 py-0.5">
              <Skeleton className="h-3.5 w-36 max-w-[80%] rounded-md" />
              <Skeleton className="h-2.5 w-full max-w-sm rounded-md" />
            </div>
            <Skeleton className="size-7 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonCardFrame>
  );
}
