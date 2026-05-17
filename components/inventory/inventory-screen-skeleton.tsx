"use client";

import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const COLS = 11;

export function InventoryScreenSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Bestand wird geladen"
      className={cn("pointer-events-none", className)}
      {...props}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          "w-[7.5rem]",
          "w-[8.5rem]",
          "w-[9rem]",
          "w-[6.5rem]",
          "w-[8rem]",
        ].map((w, i) => (
          <Skeleton key={i} className={cn("h-8 rounded-full", w)} />
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <Skeleton className="h-11 max-w-xl rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-9 max-w-[11rem] min-w-0 flex-1 rounded-lg sm:max-w-[13rem]"
            />
          ))}
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <Skeleton className="h-12 w-36 rounded-full" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-none dark:shadow-sm">
        <table className="w-full min-w-[1180px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              {Array.from({ length: COLS }).map((_, i) => (
                <th key={i} className="px-2 py-2">
                  <Skeleton className="mx-auto h-3.5 max-w-[4.5rem] rounded-md" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, row) => (
              <tr
                key={row}
                className="border-b border-border/40 last:border-0"
              >
                {Array.from({ length: COLS }).map((_, col) => (
                  <td key={col} className="px-2 py-1.5 align-middle">
                    <Skeleton className="h-9 w-full min-w-[2.5rem] rounded-xl" />
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
