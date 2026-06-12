"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import type { NewsViewMode } from "@/lib/constants/news-platforms";
import { cn } from "@/lib/utils";

function NewsCardSkeleton({ withImage = true }: { withImage?: boolean }) {
  return (
    <SkeletonCardFrame className="overflow-hidden shadow-card">
      {withImage ? <Skeleton className="h-40 w-full rounded-none" /> : null}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3 w-16 shrink-0 rounded-md" />
        </div>
        <Skeleton className="h-4 w-[70%] rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-[85%] rounded-md" />
      </div>
    </SkeletonCardFrame>
  );
}

export function NewsFeedSkeleton({
  viewMode = "grid",
  className,
  ...props
}: ComponentProps<"div"> & { viewMode?: NewsViewMode }) {
  if (viewMode === "list") {
    return (
      <div
        aria-busy
        aria-label="News werden geladen"
        className={cn("pointer-events-none space-y-3", className)}
        {...props}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <NewsCardSkeleton key={i} withImage={i % 2 === 0} />
        ))}
      </div>
    );
  }

  return (
    <div
      aria-busy
      aria-label="News werden geladen"
      className={cn(
        "pointer-events-none grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
      {...props}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <NewsCardSkeleton key={i} withImage={i % 3 !== 2} />
      ))}
    </div>
  );
}
