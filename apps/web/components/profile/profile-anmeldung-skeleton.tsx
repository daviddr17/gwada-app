"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

function OAuthRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-5 w-44 rounded-full" />
      </div>
      <Skeleton className="h-11 w-full max-w-[14rem] shrink-0 rounded-xl sm:ms-auto" />
    </div>
  );
}

export function ProfileAnmeldungSkeleton() {
  return (
    <div className="space-y-6 pb-4">
      <SkeletonCardFrame className="shadow-card">
        <div className="space-y-2 border-b border-border/30 pb-4">
          <Skeleton className="h-8 w-52 max-w-full rounded-md" />
          <Skeleton className="h-4 w-full max-w-lg rounded-md" />
          <Skeleton className="h-4 w-full max-w-md rounded-md" />
        </div>
        <div className="space-y-4 pt-4">
          <OAuthRowSkeleton />
          <div className="border-t border-border/40" />
          <OAuthRowSkeleton />
          <Skeleton className="h-3 w-full max-w-md rounded-md" />
        </div>
      </SkeletonCardFrame>

      <SkeletonCardFrame className="shadow-card">
        <div className="space-y-2 border-b border-border/30 pb-4">
          <Skeleton className="h-8 w-48 max-w-full rounded-md" />
          <Skeleton className="h-4 w-full max-w-xl rounded-md" />
          <Skeleton className="h-4 w-full max-w-lg rounded-md" />
        </div>
        <div className="space-y-4 pt-4">
          <FieldBlock />
          <FieldBlock />
          <FieldBlock />
        </div>
        <div className="mt-4 border-t border-border/40 px-2 py-4 sm:px-2">
          <Skeleton className="h-11 w-full max-w-xs rounded-lg" />
        </div>
      </SkeletonCardFrame>
    </div>
  );
}

function FieldBlock() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-36 rounded-md" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
