"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABLE_COLS = 6;
const TABLE_ROWS = 8;

type DocumentsProtocolTableSkeletonProps = ComponentProps<"div"> & {
  compact?: boolean;
};

export function DocumentsProtocolTableSkeleton({
  className,
  compact = false,
  ...props
}: DocumentsProtocolTableSkeletonProps) {
  const rows = compact ? 5 : TABLE_ROWS;
  const minWidth = compact ? "720px" : "800px";

  return (
    <SkeletonCardFrame
      aria-busy
      aria-label="Protokoll wird geladen"
      className={cn(
        "pointer-events-none overflow-hidden p-0 shadow-card",
        compact && "rounded-lg shadow-none",
        className,
      )}
      {...props}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              {Array.from({ length: compact ? 4 : TABLE_COLS }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-3.5 max-w-[4.5rem] rounded-md" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr
                key={row}
                className="border-b border-border/40 last:border-0"
              >
                {Array.from({ length: compact ? 4 : TABLE_COLS }).map(
                  (_, col) => (
                    <td key={col} className="px-4 py-3">
                      <Skeleton className="h-5 w-full min-w-[2rem] rounded-md" />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SkeletonCardFrame>
  );
}
