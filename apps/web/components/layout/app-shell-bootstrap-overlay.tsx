"use client";

import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import { cn } from "@/lib/utils";

/** Vollflächiger Bootstrap — blockiert Klicks bis Shell wirklich bereit ist. */
export function AppShellBootstrapOverlay() {
  return (
    <div
      className="fixed inset-0 z-[195] flex bg-background"
      role="status"
      aria-busy="true"
      aria-label="App wird vorbereitet"
    >
      <aside
        className={cn(
          "hidden w-[var(--sidebar-width)] shrink-0 border-r border-border/50 md:flex md:flex-col md:gap-3 md:p-3",
          appChromeFixedZoneBgClassName,
        )}
      >
        <div className="flex items-center gap-2 px-2 py-2">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-[70%] rounded-md" />
            <Skeleton className="h-3 w-[55%] rounded-md" />
          </div>
        </div>
        <div className="space-y-2 px-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-9 w-full rounded-lg"
              style={{ width: `${58 + (i % 3) * 10}%` }}
            />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "flex h-[var(--app-chrome-header-h)] shrink-0 items-center gap-3 border-b border-border/50 px-4",
            appChromeFixedZoneBgClassName,
          )}
        >
          <Skeleton className="hidden size-8 rounded-lg md:block" />
          <Skeleton className="h-5 w-28 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="size-8 rounded-full md:hidden" />
          <Skeleton className="hidden size-8 rounded-full md:block" />
          <Skeleton className="hidden size-8 rounded-full md:block" />
          <Skeleton className="hidden size-8 rounded-full md:block" />
        </header>

        <div className="flex-1 space-y-4 overflow-hidden p-4 md:p-6">
          <Skeleton className="h-6 w-40 rounded-md" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DashboardWidgetTileSkeleton />
            <DashboardWidgetTileSkeleton />
            <DashboardWidgetTileSkeleton />
          </div>
        </div>

        <div
          className={cn(
            "flex h-14 shrink-0 items-center justify-around border-t border-border/50 px-2 md:hidden",
            "pb-[env(safe-area-inset-bottom,0px)]",
            appChromeFixedZoneBgClassName,
          )}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="size-5 rounded-md" />
              <Skeleton className="h-2 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
