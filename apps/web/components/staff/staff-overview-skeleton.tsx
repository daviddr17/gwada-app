"use client";

import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ModuleDataTableBodySkeleton,
  ModuleDataTableHeadSkeleton,
  ModuleDataTableSkeletonFrame,
} from "@/lib/ui/module-data-table-skeleton";
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
        <div
          key={i}
          className="space-y-2 rounded-xl border border-border/50 bg-card px-4 py-3"
        >
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function StaffOverviewTableSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <ModuleDataTableSkeletonFrame
      aria-label="Mitarbeiter werden geladen"
      className={className}
      {...props}
    >
      <div className="border-b border-border/50 px-4 py-3">
        <Skeleton className="h-10 max-w-md rounded-xl" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <ModuleDataTableHeadSkeleton columnCount={TABLE_COLS} />
          <ModuleDataTableBodySkeleton
            columnCount={TABLE_COLS}
            rowCount={TABLE_ROWS}
          />
        </table>
      </div>
    </ModuleDataTableSkeletonFrame>
  );
}
