"use client";

import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DocumentNotesSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Notizen werden geladen"
      className={cn(
        "pointer-events-none space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3",
        className,
      )}
      {...props}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-[85%] max-w-sm" />
        </div>
      ))}
    </div>
  );
}
