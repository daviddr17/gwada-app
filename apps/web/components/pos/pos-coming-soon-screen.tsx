"use client";

import { MonitorSmartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function PosComingSoonScreen() {
  return (
    <div className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <MonitorSmartphone
          className="size-6 text-muted-foreground"
          aria-hidden
        />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold tracking-tight">Coming soon</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Native Kasse mit TSE — in Vorbereitung und noch nicht öffentlich
          verfügbar.
        </p>
      </div>
    </div>
  );
}

export function PosComingSoonSkeleton() {
  return (
    <div
      className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16"
      aria-hidden
    >
      <Skeleton className="size-12 rounded-2xl" />
      <Skeleton className="h-6 w-36 rounded-md" />
      <Skeleton className="h-4 w-72 max-w-full rounded-md" />
    </div>
  );
}
