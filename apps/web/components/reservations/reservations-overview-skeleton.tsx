"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ReservationsOverviewSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-busy
      aria-label="Reservierungen werden geladen"
      className={cn("pointer-events-none space-y-4", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCardFrame key={i} className="border-border/50 p-4 shadow-card">
          <Skeleton className="mb-3 h-5 w-36 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </SkeletonCardFrame>
      ))}
    </div>
  );
}
