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
      className={cn("pointer-events-none", className)}
      {...props}
    >
      <NewsGridSkeleton />
    </div>
  );
}
