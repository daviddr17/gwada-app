"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function DayCardSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-36 max-w-[55%]" />
        <Skeleton className="size-8 shrink-0 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </SkeletonCardFrame>
  );
}

export function StaffWorkHoursSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Arbeitszeiten werden geladen"
      className={cn("pointer-events-none space-y-4", className)}
      {...props}
    >
      <div className="-mx-4 border-b border-border/50 bg-app-chrome px-4 py-1.5 sm:-mx-6 sm:px-6 sm:py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Skeleton className="size-8 rounded-lg sm:size-9" />
            <Skeleton className="h-8 w-[8.25rem] rounded-xl sm:h-9 sm:w-[9.5rem]" />
            <Skeleton className="h-8 w-[4.25rem] rounded-xl sm:h-9 sm:w-[4.75rem]" />
            <Skeleton className="size-8 rounded-lg sm:size-9" />
          </div>
          <Skeleton className="h-7 w-14 rounded-full sm:h-8 sm:w-16" />
        </div>
      </div>

      <SkeletonCardFrame className="shadow-card">
        <Skeleton className="mb-3 h-5 w-48 max-w-[75%]" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full max-w-[11rem]" />
          ))}
        </div>
      </SkeletonCardFrame>

      <SkeletonCardFrame className="shadow-card">
        <Skeleton className="h-5 w-36 max-w-[60%]" />
      </SkeletonCardFrame>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <DayCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
