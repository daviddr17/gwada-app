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
      <div className="overflow-hidden rounded-xl border border-border/50 shadow-card">
        <Skeleton className="h-36 w-full rounded-none md:h-44" />
        <div className="space-y-4 px-5 pb-5">
          <Skeleton className="-mt-12 size-24 rounded-full border-4 border-card sm:-mt-14" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow />
            <FieldRow />
          </div>
        </div>
      </div>
      <SkeletonCardFrame className="shadow-card">
        <div className="space-y-4 pt-4">
          <FieldRow wideLabel />
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
