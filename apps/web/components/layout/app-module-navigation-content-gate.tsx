"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppModuleNavContentSkeleton } from "@/components/layout/app-module-nav-content-skeleton";
import {
  normalizeNavHref,
  useSoftNavLock,
} from "@/components/providers/soft-nav-lock-provider";
import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";
import { cn } from "@/lib/utils";

/** Inhalts-Skeleton während Soft-Nav-Flight — Sidebar/Header bleiben klickbar. */
export function AppModuleNavigationContentGate({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();

  const crossModulePending =
    pendingHref != null &&
    crossAppModuleNavigation(pathname, pendingHref) &&
    normalizeNavHref(pathname) !== normalizeNavHref(pendingHref);

  return (
    <div className="relative min-h-full">
      {crossModulePending ? (
        <div
          className={cn(
            "absolute inset-0 z-10 min-h-full bg-background",
            "pointer-events-auto",
          )}
          aria-busy
          aria-live="polite"
        >
          <AppModuleNavContentSkeleton pendingHref={pendingHref} />
        </div>
      ) : null}
      <div
        className={cn(crossModulePending && "invisible")}
        aria-hidden={crossModulePending}
      >
        {children}
      </div>
    </div>
  );
}
