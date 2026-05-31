"use client";

import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StaffExportSummarySkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Exportdaten werden geladen"
      className={cn(
        "pointer-events-none grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      {...props}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full max-w-[11rem]" />
      ))}
    </div>
  );
}

export function StaffExportEntriesSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <Skeleton
      aria-busy
      aria-label="Einträge werden geladen"
      className={cn("h-12 w-full rounded-xl", className)}
      {...props}
    />
  );
}
