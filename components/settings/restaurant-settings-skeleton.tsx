"use client";

import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

function FieldRow() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28 max-w-[45%] rounded-md" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export function RestaurantSettingsSkeleton({
  section,
}: {
  section: "restaurant" | "hours";
}) {
  if (section === "hours") {
    return (
      <div className="space-y-6 pb-4">
        <SkeletonCardFrame className="shadow-card">
          <div className="space-y-2 border-b border-border/30 pb-4">
            <Skeleton className="h-8 w-80 max-w-full rounded-md" />
            <Skeleton className="h-4 w-full max-w-xl rounded-md" />
            <Skeleton className="h-4 w-full max-w-lg rounded-md" />
          </div>
          <div className="space-y-3 pt-5">
            <Skeleton className="h-5 w-48 rounded-md" />
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <Skeleton className="h-4 w-28 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-wrap justify-end gap-2">
                  <Skeleton className="h-9 w-28 rounded-lg" />
                  <Skeleton className="h-9 w-28 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCardFrame>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="overflow-hidden rounded-xl border border-border/50 shadow-card">
        <Skeleton className="h-36 w-full rounded-none md:h-44" />
        <div className="space-y-4 px-5 pb-5">
          <Skeleton className="-mt-12 size-24 rounded-full border-4 border-card sm:-mt-14" />
          <FieldRow />
        </div>
      </div>
      <SkeletonCardFrame className="shadow-card">
        <div className="space-y-2 border-b border-border/30 pb-4">
          <Skeleton className="h-7 w-44 rounded-md" />
          <Skeleton className="h-4 w-full max-w-md rounded-md" />
        </div>
        <div className="space-y-4 pt-4">
          <FieldRow />
          <FieldRow />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow />
            <FieldRow />
          </div>
          <FieldRow />
          <FieldRow />
          <FieldRow />
        </div>
      </SkeletonCardFrame>
      <SkeletonCardFrame className="shadow-card">
        <div className="space-y-2 border-b border-border/30 pb-4">
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-4 w-full max-w-md rounded-md" />
        </div>
        <div className="flex items-center gap-3 pt-5">
          <Skeleton className="size-12 shrink-0 rounded-lg" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </SkeletonCardFrame>
    </div>
  );
}
