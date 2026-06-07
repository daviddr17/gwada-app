"use client";

import type { ComponentProps } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ContractCardSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-3 shadow-card">
      <div className="space-y-2">
        <Skeleton className="h-5 w-[70%] max-w-[14rem]" />
        <Skeleton className="h-5 w-[55%] max-w-[12rem]" />
      </div>
      <Skeleton className="h-4 w-[80%] max-w-[16rem]" />
      <Skeleton className="h-4 w-[45%] max-w-[10rem]" />
    </SkeletonCardFrame>
  );
}

export function StaffContractsSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Verträge werden geladen"
      className={cn("pointer-events-none space-y-3", className)}
      {...props}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <ContractCardSkeleton key={i} />
      ))}
    </div>
  );
}
