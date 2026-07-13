"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function InsightsStatisticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="flex justify-end gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCardFrame key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCardFrame key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}
