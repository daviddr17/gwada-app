"use client";

import { FeedTimelineDateSkeleton } from "@/components/feed/feed-timeline-date-skeleton";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function EventsFeedSkeleton() {
  return (
    <ul className="space-y-3" aria-busy aria-label="Events werden geladen">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex gap-3 sm:gap-4">
          <FeedTimelineDateSkeleton />
          <SkeletonCardFrame className="min-w-0 flex-1 rounded-xl border border-border/50 p-3 shadow-card sm:p-3.5">
            <div className="flex gap-3 sm:gap-4">
              <Skeleton className="size-[4.5rem] shrink-0 rounded-lg sm:size-20" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </SkeletonCardFrame>
        </li>
      ))}
    </ul>
  );
}
