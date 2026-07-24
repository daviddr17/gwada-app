"use client";

import type { ReactNode } from "react";
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

/**
 * Während Soft-Nav (RSC-Flight) sofort Modul-Skeleton statt eingefrorener Vor-Seite.
 * Sidebar zeigt pendingHref bereits aktiv — Content muss mitziehen.
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

export function SoftNavPendingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { pendingHref } = useSoftNavLock();

  const pending =
    pendingHref != null &&
    normalizeNavHref(pendingHref) !== normalizeNavHref(pathname);

  // Children verstecken (nicht unmounten): RegisterModuleChrome / Layout-State bleibt,
  // bis der echte Route-Wechsel den alten Baum ersetzt — kein Chip-Strip-Flicker.
  return (
    <>
      <div
        className={pending ? "hidden" : undefined}
        aria-hidden={pending || undefined}
      >
        {children}
      </div>
      {pending && pendingHref ? (
        <AppMain>{skeletonForHref(pendingHref)}</AppMain>
      ) : null}
    </>
  );
}
