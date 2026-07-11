"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import type { NewsViewMode } from "@/lib/constants/news-platforms";
import { feedNewsGridClassName } from "@/lib/feed/feed-media-layout";
import { cn } from "@/lib/utils";

const CARD_IMAGE_ASPECTS = [
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[5/4]",
] as const;

function NewsCardSkeleton({
  withImage = true,
  imageAspect = CARD_IMAGE_ASPECTS[0],
}: {
  withImage?: boolean;
  imageAspect?: (typeof CARD_IMAGE_ASPECTS)[number];
}) {
  return (
    <SkeletonCardFrame className="overflow-hidden shadow-card">
      {withImage ? (
        <Skeleton className={cn("w-full rounded-none", imageAspect)} />
      ) : null}
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

function NewsTimelineRowSkeleton() {
  return (
    <div className="flex w-full gap-3 sm:gap-4">
      <div className="flex w-14 shrink-0 flex-col items-center sm:w-16">
        <Skeleton className="h-[3.25rem] w-full rounded-lg sm:h-[3.5rem]" />
      </div>
      <SkeletonCardFrame className="flex min-w-0 flex-1 gap-3 p-3 shadow-card sm:gap-4 sm:p-3.5">
        <Skeleton className="size-[4.5rem] shrink-0 rounded-lg sm:size-20" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-3 w-16 shrink-0 rounded-md" />
          </div>
          <Skeleton className="h-4 w-[65%] rounded-md" />
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-[80%] rounded-md" />
        </div>
      </SkeletonCardFrame>
    </div>
  );
}

function NewsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={feedNewsGridClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <NewsCardSkeleton
          key={i}
          withImage={i % 3 !== 2}
          imageAspect={CARD_IMAGE_ASPECTS[i % CARD_IMAGE_ASPECTS.length]!}
        />
      ))}
    </div>
  );
}

function NewsTimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <NewsTimelineRowSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function NewsFeedSkeleton({
  viewMode = "list",
  className,
  ...props
}: ComponentProps<"div"> & { viewMode?: NewsViewMode }) {
  if (viewMode === "list") {
    return (
      <div
        aria-busy
        aria-label="News werden geladen"
        className={cn("pointer-events-none", className)}
        {...props}
      >
        <NewsTimelineSkeleton />
      </div>
    );
  }

  return (
    <div
      aria-busy
      aria-label="News werden geladen"
      className={cn("pointer-events-none", className)}
      {...props}
    >
      <NewsGridSkeleton />
    </div>
  );
}
