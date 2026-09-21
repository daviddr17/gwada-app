"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

function IntegrationCardSkeleton() {
  return (
    <SkeletonCardFrame className="border-border/50 shadow-card">
      <div className="flex items-center gap-4 p-4">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-3 w-full max-w-md rounded-md" />
        </div>
        <Skeleton className="size-5 shrink-0 rounded-md" />
      </div>
    </SkeletonCardFrame>
  );
}

export function IntegrationenSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <IntegrationCardSkeleton />
      <IntegrationCardSkeleton />
      <IntegrationCardSkeleton />
    </div>
  );
}
