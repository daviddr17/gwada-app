"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function EventsFeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCardFrame key={i} className="rounded-xl border border-border/50 p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-2/3" />
        </SkeletonCardFrame>
      ))}
    </div>
  );
}
