"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function MenuItemCardSkeleton() {
  return (
    <SkeletonCardFrame className="overflow-hidden p-0 shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none rounded-t-xl" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-[70%] max-w-[14rem]" />
        <Skeleton className="h-3.5 w-full max-w-[12rem]" />
        <Skeleton className="h-3.5 w-[80%] max-w-[10rem]" />
        <div className="flex flex-wrap gap-2 pt-1">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex items-end justify-between gap-3 pt-2">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </SkeletonCardFrame>
  );
}

export function MenuOverviewSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Speisekarte wird geladen"
      className={cn("pointer-events-none w-full pb-16", className)}
      {...props}
    >
      <div className="-mx-4 mb-3 flex flex-wrap gap-2 px-4 sm:-mx-6 sm:px-6">
        <Skeleton className="h-8 w-[8.5rem] rounded-full" />
        <Skeleton className="h-8 w-[10.5rem] rounded-full" />
      </div>

      <div className="-mx-4 mb-3 flex items-center justify-between px-4 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/35 p-1">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <Skeleton className="size-8 shrink-0 rounded-full" />
      </div>

      <div className="sticky z-[15] -mx-4 border-b border-border/40 bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mb-6 mt-5 flex justify-end">
        <Skeleton className="h-12 w-[11.5rem] rounded-full" />
      </div>

      <div className="space-y-12">
        {[0, 1].map((section) => (
          <section key={section} className="space-y-4">
            <div className="mb-4 flex items-end gap-3">
              <Skeleton className="h-7 w-8 rounded-full" />
              <Skeleton className="h-8 w-40 max-w-[55%] sm:h-9 sm:w-52" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <MenuItemCardSkeleton key={`${section}-${i}`} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
