"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function StaffTodosTableSkeleton() {
  return (
    <SkeletonCardFrame className="overflow-hidden border-border/50 shadow-card">
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/40 px-4 py-4 last:border-0"
          >
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-5 flex-1 max-w-xs rounded-md" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonCardFrame>
  );
}

export function StaffTodosProtocolTableSkeleton() {
  return (
    <SkeletonCardFrame className="overflow-hidden border-border/50 shadow-card">
      <div className="space-y-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 border-b border-border/40 px-4 py-4 last:border-0"
          >
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
        ))}
      </div>
    </SkeletonCardFrame>
  );
}
