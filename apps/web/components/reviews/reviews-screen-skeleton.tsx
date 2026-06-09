"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ReviewSummaryCardSkeleton() {
  return (
    <SkeletonCardFrame className="shadow-card">
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div className="flex flex-wrap gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-9 w-16 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-8 shrink-0 rounded-md" />
              <Skeleton className="h-2 min-w-0 flex-1 rounded-full" />
              <Skeleton className="h-4 w-8 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonCardFrame>
  );
}

function ReviewCardSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-3 shadow-card p-6">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-3 w-16 rounded-md" />
      </div>
      <Skeleton className="h-4 w-36 max-w-[70%] rounded-md" />
      <Skeleton className="h-3 w-full rounded-md" />
      <Skeleton className="h-3 w-[85%] rounded-md" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </SkeletonCardFrame>
  );
}

export function ReviewsScreenSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Bewertungen werden geladen"
      className={cn("pointer-events-none space-y-6", className)}
      {...props}
    >
      <ReviewSummaryCardSkeleton />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 min-w-0 flex-1 rounded-2xl" />
          <Skeleton className="size-8 shrink-0 rounded-full" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
