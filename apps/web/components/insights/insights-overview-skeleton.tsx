"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function InsightsOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-wrap justify-end gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-lg" />
          ))}
        </div>
        <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCardFrame key={i} className="p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </SkeletonCardFrame>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCardFrame key={i} className="p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-3 w-full" />
          </SkeletonCardFrame>
        ))}
      </div>
    </div>
  );
}
