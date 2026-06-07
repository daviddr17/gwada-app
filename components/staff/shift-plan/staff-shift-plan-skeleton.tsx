"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function StaffShiftPlanSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <SkeletonCardFrame className="overflow-hidden p-0">
        <div className="grid grid-cols-[minmax(10rem,14rem)_repeat(7,minmax(5rem,1fr))] gap-px bg-border/40">
          <Skeleton className="h-10 rounded-none" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-none" />
          ))}
          {Array.from({ length: 4 }).flatMap((_, row) => [
            <Skeleton key={`n-${row}`} className="h-24 rounded-none" />,
            ...Array.from({ length: 7 }).map((_, col) => (
              <Skeleton key={`c-${row}-${col}`} className="h-24 rounded-none" />
            )),
          ])}
        </div>
      </SkeletonCardFrame>
    </div>
  );
}
