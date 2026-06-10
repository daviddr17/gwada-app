"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
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

function AccountingFilterChipsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {["w-[4.5rem]", "w-[5.5rem]", "w-[5rem]"].map((w, i) => (
        <Skeleton key={i} className={cn("h-8 rounded-full", w)} />
      ))}
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
    <SkeletonCardFrame
      aria-busy
      aria-label={ariaLabel}
      className={cn("overflow-hidden p-0 shadow-card", className)}
      {...props}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: minTableWidth }}>
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              {Array.from({ length: columnCount }).map((_, i) => (
                <th key={i} className="px-4 py-2">
                  <Skeleton
                    className={cn(
                      "h-3.5 rounded-md",
                      i === 0 ? "mx-auto w-4" : "max-w-[5.5rem]",
                    )}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, row) => (
              <tr
                key={row}
                className="border-b border-border/40 last:border-0"
              >
                {Array.from({ length: columnCount }).map((_, col) => (
                  <td key={col} className="px-4 py-3 align-middle">
                    <Skeleton
                      className={cn(
                        "rounded-md",
                        col === 0 ? "mx-auto size-5" : "h-5 w-full min-w-[2.5rem]",
                      )}
                    />
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

      <AccountingFilterChipsSkeleton />

      <Skeleton className="h-11 max-w-xl rounded-2xl" />

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

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-24 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
