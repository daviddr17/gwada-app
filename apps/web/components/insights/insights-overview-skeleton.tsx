"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function InsightsOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-wrap justify-end gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCardFrame key={i} className="p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </SkeletonCardFrame>
        ))}
      </div>
    </div>
  );
}
