"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABLE_COLS = 8;
const TABLE_ROWS = 7;

export function StaffOverviewDayStatsSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-hidden
      className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}
      {...props}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCardFrame key={i} className="space-y-2 px-4 py-3 shadow-none">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-8 w-16" />
        </SkeletonCardFrame>
      ))}
    </div>
  );
}

export function StaffOverviewTableSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Mitarbeiter werden geladen"
      className={cn("pointer-events-none", className)}
      {...props}
    >
      <div className="border-b border-border/50 px-4 py-3">
        <Skeleton className="h-10 max-w-md rounded-xl" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              {Array.from({ length: TABLE_COLS }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-3.5 max-w-[5.5rem] rounded-md" />
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
    </div>
  );
}
