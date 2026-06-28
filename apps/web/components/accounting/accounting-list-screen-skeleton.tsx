"use client";

import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ModuleDataTableBodySkeleton,
  ModuleDataTableHeadSkeleton,
  ModuleDataTableSkeletonFrame,
} from "@/lib/ui/module-data-table-skeleton";
import { cn } from "@/lib/utils";

function AccountingCatalogToolbarSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {["w-[7rem]", "w-[6.5rem]", "w-[7.5rem]", "w-[8rem]"].map((w, i) => (
        <Skeleton key={i} className={cn("h-8 rounded-full", w)} />
      ))}
    </div>
  );
}

function AccountingSearchFilterRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-2">
      <Skeleton className="h-11 min-w-0 flex-1 rounded-2xl" />
      <Skeleton className="size-11 shrink-0 rounded-full" />
    </div>
  );
}

export function AccountingListTableSkeleton({
  columnCount,
  rowCount = 8,
  minTableWidth = "640px",
  ariaLabel = "Liste wird geladen",
  className,
  ...props
}: ComponentProps<"div"> & {
  columnCount: number;
  rowCount?: number;
  minTableWidth?: string;
  ariaLabel?: string;
}) {
  return (
    <ModuleDataTableSkeletonFrame
      aria-busy
      aria-label={ariaLabel}
      className={className}
      {...props}
    >
      <table className="w-full text-sm" style={{ minWidth: minTableWidth }}>
        <ModuleDataTableHeadSkeleton
          columnCount={columnCount}
          cellClassName="px-4 py-2"
        />
        <ModuleDataTableBodySkeleton
          columnCount={columnCount}
          rowCount={rowCount}
          cellClassName="px-4 py-3 align-middle"
          renderCell={(col) => (
            <Skeleton
              className={cn(
                "rounded-md",
                col === 0 ? "mx-auto size-5" : "h-5 w-full min-w-[2.5rem]",
              )}
            />
          )}
        />
      </table>
    </ModuleDataTableSkeletonFrame>
  );
}

export function AccountingListScreenSkeleton({
  columnCount,
  minTableWidth,
  ariaLabel,
  showCatalogToolbar = false,
  showLexwareSync = false,
  showAddButton = false,
  className,
  ...props
}: ComponentProps<"div"> & {
  columnCount: number;
  minTableWidth?: string;
  ariaLabel?: string;
  showCatalogToolbar?: boolean;
  showLexwareSync?: boolean;
  showAddButton?: boolean;
}) {
  return (
    <div
      className={cn("pointer-events-none space-y-4", className)}
      {...props}
    >
      {showCatalogToolbar ? <AccountingCatalogToolbarSkeleton /> : null}

      <AccountingSearchFilterRowSkeleton />

      {showLexwareSync ? (
        <div className="flex justify-end">
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
      ) : null}

      {showAddButton ? (
        <Skeleton className="h-11 w-full rounded-xl" />
      ) : null}

      <AccountingListTableSkeleton
        columnCount={columnCount}
        minTableWidth={minTableWidth}
        ariaLabel={ariaLabel}
      />

      <div className="flex items-center justify-between gap-3 pb-3">
        <Skeleton className="h-4 w-24 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
