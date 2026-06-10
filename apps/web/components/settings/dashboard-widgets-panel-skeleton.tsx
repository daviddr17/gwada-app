"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function DashboardWidgetsPanelSkeleton() {
  return (
    <SkeletonCardFrame className="shadow-card">
      <div className="space-y-2 border-b border-border/30 pb-4">
        <Skeleton className="h-8 w-48 max-w-full rounded-md" />
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
        <Skeleton className="h-4 w-full max-w-lg rounded-md" />
      </div>
      <div className="space-y-3 pt-4">
        <Skeleton className="h-3 w-full max-w-md rounded-md" />
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/15 py-2 pe-3 ps-2"
          >
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2 py-1">
              <Skeleton className="h-4 w-40 max-w-[80%] rounded-md" />
              <Skeleton className="h-3 w-full max-w-sm rounded-md" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonCardFrame>
  );
}
