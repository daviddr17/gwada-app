"use client";

import type { ComponentProps, ReactNode } from "react";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SettingsToggleRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-44 max-w-full rounded-md" />
        <Skeleton className="h-3 w-full max-w-sm rounded-md" />
      </div>
      <Skeleton className="size-6 shrink-0 rounded-full" />
    </div>
  );
}

function SettingsCardSkeleton({
  titleWidth = "w-28",
  children,
}: {
  titleWidth?: string;
  children: ReactNode;
}) {
  return (
    <SkeletonCardFrame className="space-y-4 shadow-card">
      <Skeleton className={cn("h-5 rounded-md", titleWidth)} />
      {children}
    </SkeletonCardFrame>
  );
}

export function AccountingSettingsSkeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-busy
      aria-label="Buchführungs-Einstellungen werden geladen"
      className={cn("pointer-events-none space-y-4 pb-4", className)}
      {...props}
    >
      <SettingsCardSkeleton titleWidth="w-24">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-3 w-full max-w-md rounded-md" />
        </div>
        <SettingsToggleRowSkeleton />
        <SettingsToggleRowSkeleton />
      </SettingsCardSkeleton>

      <SettingsCardSkeleton titleWidth="w-44">
        <Skeleton className="h-3 w-full max-w-lg rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-3"
            >
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="size-6 rounded-full" />
              </div>
              <Skeleton className="h-3 w-36 rounded-md" />
            </div>
          ))}
        </div>
      </SettingsCardSkeleton>

      <SettingsCardSkeleton titleWidth="w-52">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </SettingsCardSkeleton>
    </div>
  );
}
