"use client";

import type { ComponentProps, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  moduleDataTableHeadRowClassName,
  moduleDataTableShellClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";

export function ModuleDataTableSkeletonFrame({
  children,
  className,
  shellClassName = moduleDataTableShellClassName,
  ...props
}: ComponentProps<"div"> & {
  shellClassName?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none", shellClassName, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ModuleDataTableHeadSkeleton({
  columnCount,
  cellClassName = "px-4 py-3",
}: {
  columnCount: number;
  cellClassName?: string;
}) {
  return (
    <thead>
      <tr className={moduleDataTableHeadRowClassName}>
        {Array.from({ length: columnCount }).map((_, i) => (
          <th key={i} className={cellClassName}>
            <Skeleton className="h-3.5 max-w-[5.5rem] rounded-md" />
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function ModuleDataTableBodySkeleton({
  columnCount,
  rowCount = 8,
  cellClassName = "px-4 py-3",
  renderCell,
}: {
  columnCount: number;
  rowCount?: number;
  cellClassName?: string;
  renderCell?: (col: number) => ReactNode;
}) {
  return (
    <tbody>
      {Array.from({ length: rowCount }).map((_, row) => (
        <tr key={row} className="border-b border-border/40 last:border-0">
          {Array.from({ length: columnCount }).map((_, col) => (
            <td key={col} className={cellClassName}>
              {renderCell ? (
                renderCell(col)
              ) : (
                <Skeleton className="h-5 w-full min-w-[2.5rem] rounded-md" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
