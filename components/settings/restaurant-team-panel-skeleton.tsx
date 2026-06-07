"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABLE_ROWS = 6;
const TABLE_COLS = 4;

export function RestaurantTeamPanelSkeleton({
  embedded = false,
  className,
  ...props
}: ComponentProps<"div"> & { embedded?: boolean }) {
  const table = (
    <div className={cn("overflow-x-auto", embedded ? undefined : "px-4 sm:px-6")}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: TABLE_COLS }).map((_, i) => (
              <th key={i} className="py-3 pr-4">
                <Skeleton className="h-3.5 max-w-[4.5rem] rounded-md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: TABLE_ROWS }).map((_, row) => (
            <tr key={row} className="border-b border-border/60 last:border-0">
              <td className="py-3 pr-4">
                <Skeleton className="h-5 w-[8rem] max-w-full rounded-md" />
              </td>
              <td className="py-3 pr-4">
                <Skeleton className="h-9 w-[12.5rem] max-w-full rounded-lg" />
              </td>
              <td className="py-3 text-center">
                <Skeleton className="mx-auto h-6 w-11 rounded-full" />
              </td>
              <td className="py-3 text-right">
                <Skeleton className="ml-auto h-9 w-[6.5rem] rounded-lg" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (embedded) {
    return (
      <div
        aria-busy
        aria-label="Team wird geladen"
        className={cn("pointer-events-none", className)}
        {...props}
      >
        <div className="mb-4 space-y-2">
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
        {table}
      </div>
    );
  }

  return (
    <SkeletonCardFrame
      aria-busy
      aria-label="Team wird geladen"
      className={cn("pointer-events-none overflow-hidden p-0 shadow-card", className)}
      {...props}
    >
      <div className="space-y-2 border-b border-border/50 px-4 py-4 sm:px-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      {table}
    </SkeletonCardFrame>
  );
}
