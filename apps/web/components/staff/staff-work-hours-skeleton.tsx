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
      <SkeletonCardFrame className="shadow-card">
        <Skeleton className="mb-3 h-5 w-48 max-w-[75%]" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full max-w-[11rem]" />
          ))}
        </div>
      </SkeletonCardFrame>

      <SkeletonCardFrame className="flex flex-col gap-3 px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="mx-auto h-5 w-32 sm:mx-0" />
        <div className="flex items-center justify-center gap-1">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-9 w-[9.5rem] rounded-xl" />
          <Skeleton className="h-9 w-[4.75rem] rounded-xl" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </SkeletonCardFrame>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <DayCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
