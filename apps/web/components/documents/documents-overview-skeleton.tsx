"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABLE_COLS = 7;
const TABLE_ROWS = 8;

export function DocumentsOverviewStorageSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <SkeletonCardFrame
      aria-busy
      aria-hidden
      className={cn("mb-4 space-y-2 shadow-card", className)}
      {...props}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </SkeletonCardFrame>
  );
}

export function DocumentsOverviewTableSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <SkeletonCardFrame
      aria-busy
      aria-label="Dokumente werden geladen"
      className={cn("pointer-events-none overflow-hidden p-0 shadow-card", className)}
      {...props}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              {Array.from({ length: TABLE_COLS }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-4 max-w-[5.5rem] rounded-md" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: TABLE_ROWS }).map((_, row) => (
              <tr
                key={row}
                className="border-b border-border/40 last:border-0"
              >
                {Array.from({ length: TABLE_COLS }).map((_, col) => (
                  <td key={col} className="px-4 py-3">
                    <Skeleton className="h-5 w-full min-w-[2.5rem] rounded-md" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SkeletonCardFrame>
  );
}
