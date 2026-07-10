"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StaffAvailabilityEditorSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true">
      <SkeletonCardFrame className="border-border/50 shadow-card">
        <Skeleton className="h-5 w-40" />
        {!compact ? <Skeleton className="mt-2 h-4 w-full max-w-md" /> : null}
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </SkeletonCardFrame>
      <SkeletonCardFrame className="border-border/50 shadow-card">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-11 w-full rounded-xl" />
      </SkeletonCardFrame>
    </div>
  );
}
