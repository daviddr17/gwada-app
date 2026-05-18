"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

function FieldRow({ wideLabel }: { wideLabel?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton
        className={wideLabel ? "h-4 w-40 rounded-md" : "h-4 w-24 rounded-md"}
      />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export function ProfilePersoenlicheDatenSkeleton() {
  return (
    <div className="space-y-6 pb-4">
      <SkeletonCardFrame className="shadow-card">
        <div className="space-y-2 border-b border-border/30 pb-4">
          <Skeleton className="h-8 w-56 max-w-full rounded-md" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
          <Skeleton className="h-4 w-full max-w-xl rounded-md" />
        </div>
        <div className="space-y-4 pt-4">
          <FieldRow wideLabel />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow />
            <FieldRow />
          </div>
          <FieldRow />
          <div className="my-2 border-t border-border/40" />
          <Skeleton className="h-4 w-40 rounded-md" />
          <FieldRow wideLabel />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow />
            <FieldRow />
          </div>
          <FieldRow wideLabel />
        </div>
      </SkeletonCardFrame>
    </div>
  );
}
