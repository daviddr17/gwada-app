"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

function DocumentRowSkeleton() {
  return (
    <SkeletonCardFrame className="border-border/50 shadow-card">
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48 max-w-full rounded-md" />
            <Skeleton className="h-3 w-36 max-w-full rounded-md" />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
    </SkeletonCardFrame>
  );
}

export function ProfileDocumentsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-9 w-40 rounded-full" />
      <div className="space-y-3">
        <DocumentRowSkeleton />
        <DocumentRowSkeleton />
        <DocumentRowSkeleton />
      </div>
    </div>
  );
}
