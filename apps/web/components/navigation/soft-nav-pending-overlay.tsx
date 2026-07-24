"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import { AccountingListScreenSkeleton } from "@/components/accounting/accounting-list-screen-skeleton";
import { DocumentsOverviewTableSkeleton } from "@/components/documents/documents-overview-skeleton";
import { InventoryScreenSkeleton } from "@/components/inventory/inventory-screen-skeleton";
import { MenuOverviewSkeleton } from "@/components/menu/menu-overview-skeleton";
import { NewsFeedSkeleton } from "@/components/news/news-feed-skeleton";
import { ReservationsOverviewSkeleton } from "@/components/reservations/reservations-overview-skeleton";
import { ReviewsScreenSkeleton } from "@/components/reviews/reviews-screen-skeleton";
import { StaffOverviewTableSkeleton } from "@/components/staff/staff-overview-skeleton";
import { StaffTodosTableSkeleton } from "@/components/staff/todos/staff-todos-skeleton";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  normalizeNavHref,
  useSoftNavLock,
} from "@/components/providers/soft-nav-lock-provider";
import { useAppModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { SIDEBAR_MODULE_DEFINITIONS } from "@/lib/constants/sidebar-modules";

/**
 * Sofortiges Modul-Skeleton über dem Scroll-Bereich — Sibling zu {children},
 * kein Unmount des Router-Outlets (sonst stirbt der Next-Flight).
 */
function GenericModulePendingSkeleton() {
  return (
    <div aria-busy aria-label="Modul wird geladen" className="space-y-4">
      <Skeleton className="h-11 w-full rounded-xl" />
      <SkeletonCardFrame className="space-y-3 p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-4/5 rounded-lg" />
      </SkeletonCardFrame>
    </div>
  );
}

function skeletonForHref(href: string): ReactNode {
  const path = normalizeNavHref(href);
  if (path.startsWith("/dashboard/menu")) return <MenuOverviewSkeleton />;
  if (path.startsWith("/dashboard/mitarbeiter")) {
    return <StaffOverviewTableSkeleton />;
  }
  if (path.startsWith("/dashboard/reservierungen")) {
    return <ReservationsOverviewSkeleton />;
  }
  if (path.startsWith("/dashboard/inventory")) {
    return <InventoryScreenSkeleton />;
  }
  if (path.startsWith("/dashboard/bewertungen")) {
    return <ReviewsScreenSkeleton />;
  }
  if (path.startsWith("/dashboard/dokumente")) {
    return <DocumentsOverviewTableSkeleton />;
  }
  if (path.startsWith("/dashboard/buchfuehrung")) {
    return <AccountingListScreenSkeleton columnCount={6} />;
  }
  if (path.startsWith("/dashboard/news")) return <NewsFeedSkeleton />;
  if (path.startsWith("/dashboard/checklisten")) {
    return <StaffTodosTableSkeleton />;
  }
  return <GenericModulePendingSkeleton />;
}

function titleForHref(href: string): string | null {
  const path = normalizeNavHref(href);
  if (path === "/dashboard") return "Dashboard";
  const mod = SIDEBAR_MODULE_DEFINITIONS.find(
    (m) => path === m.pathPrefix || path.startsWith(`${m.pathPrefix}/`),
  );
  return mod?.label ?? null;
}

export function SoftNavPendingOverlay() {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();
  const { setChrome } = useAppModuleChrome();
  const prevTitleRef = useRef<string | null>(null);
  const optimisticTargetRef = useRef<string | null>(null);

  const pending =
    pendingHref != null &&
    normalizeNavHref(pendingHref) !== normalizeNavHref(pathname);

  // Optimistischen Titel setzen; bei abgebrochenem Nav wiederherstellen.
  useLayoutEffect(() => {
    if (pending && pendingHref) {
      const title = titleForHref(pendingHref);
      if (!title) return;
      optimisticTargetRef.current = normalizeNavHref(pendingHref);
      setChrome((prev) => {
        if (prevTitleRef.current == null) prevTitleRef.current = prev.title;
        return { ...prev, title };
      });
      return;
    }

    const target = optimisticTargetRef.current;
    const restore = prevTitleRef.current;
    optimisticTargetRef.current = null;
    prevTitleRef.current = null;
    if (!target || restore == null) return;
    // Navigation erfolgreich — Modul-Chrome setzt den Titel.
    if (normalizeNavHref(pathname) === target) return;
    setChrome((prev) => ({ ...prev, title: restore }));
  }, [pending, pendingHref, pathname, setChrome]);

  if (!pending || !pendingHref) return null;

  return (
    <div
      // pointer-events-none: Overlay darf den aktivierenden Link-Klick nicht schlucken.
      className="pointer-events-none absolute inset-0 z-20 min-h-full bg-background"
      aria-live="polite"
      aria-busy
    >
      <AppMain>{skeletonForHref(pendingHref)}</AppMain>
    </div>
  );
}
