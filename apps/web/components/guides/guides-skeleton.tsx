"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ModuleDataTableSkeletonFrame } from "@/lib/ui/module-data-table-skeleton";

export function GuidesTableSkeleton() {
  return (
    <ModuleDataTableSkeletonFrame aria-label="Anleitungen werden geladen">
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/40 px-4 py-4 last:border-0"
          >
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-5 flex-1 max-w-xs rounded-md" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        ))}
      </div>
    </ModuleDataTableSkeletonFrame>
  );
}
