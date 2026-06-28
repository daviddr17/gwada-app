"use client";

import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ModuleDataTableBodySkeleton,
  ModuleDataTableHeadSkeleton,
  ModuleDataTableSkeletonFrame,
} from "@/lib/ui/module-data-table-skeleton";
import { cn } from "@/lib/utils";

const TABLE_COLS = 7;
const TABLE_ROWS = 8;

export function DocumentsOverviewStorageSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-hidden
      className={cn(
        "mb-4 space-y-2 rounded-xl border border-border/50 bg-card p-4",
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function DocumentsOverviewTableSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <ModuleDataTableSkeletonFrame
      aria-label="Dokumente werden geladen"
      className={className}
      {...props}
    >
      <table className="w-full min-w-[52rem] text-sm">
        <ModuleDataTableHeadSkeleton columnCount={TABLE_COLS} />
        <ModuleDataTableBodySkeleton
          columnCount={TABLE_COLS}
          rowCount={TABLE_ROWS}
        />
      </table>
    </ModuleDataTableSkeletonFrame>
  );
}
