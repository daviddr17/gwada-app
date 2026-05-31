"use client";

import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { workspaceRestaurantCardClassName } from "@/components/workspace/workspace-restaurant-card";
import { cn } from "@/lib/utils";

const SKELETON_CARD_COUNT = 4;

function WorkspaceRestaurantCardSkeleton() {
  return (
    <div className={workspaceRestaurantCardClassName} aria-hidden>
      <Skeleton className="h-28 w-full rounded-none sm:h-32" />
      <div className="relative px-4 pb-4">
        <Skeleton className="-mt-10 mb-3 size-20 rounded-full" />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4 max-w-[12rem]" />
            <Skeleton className="h-3.5 w-1/2 max-w-[8rem]" />
          </div>
          <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function WorkspaceRestaurantsSkeleton({
  className,
  ...props
}: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("grid gap-4 sm:grid-cols-2", className)}
      aria-busy
      aria-label="Restaurants werden geladen"
      {...props}
    >
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
        <li key={i}>
          <WorkspaceRestaurantCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
