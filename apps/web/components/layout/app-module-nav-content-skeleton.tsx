"use client";

import { InventoryScreenSkeleton } from "@/components/inventory/inventory-screen-skeleton";
import { MenuOverviewSkeleton } from "@/components/menu/menu-overview-skeleton";
import { ReservationsOverviewSkeleton } from "@/components/reservations/reservations-overview-skeleton";
import { StaffOverviewTableSkeleton } from "@/components/staff/staff-overview-skeleton";
import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

function GenericModuleContentSkeleton() {
  return (
    <div className="space-y-4 p-4 md:p-6" aria-busy aria-label="Modul wird geladen">
      <Skeleton className="h-9 w-full max-w-md rounded-xl" />
      <SkeletonCardFrame className="border-border/50 shadow-card">
        <Skeleton className="mb-3 h-5 w-32 rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </SkeletonCardFrame>
      <DashboardWidgetTileSkeleton />
    </div>
  );
}

export function AppModuleNavContentSkeleton({
  pendingHref,
}: {
  pendingHref: string | null;
}) {
  const path = pendingHref?.split("?")[0] ?? "";

  if (path.startsWith("/dashboard/mitarbeiter")) {
    return (
      <div className="p-4 md:p-6" aria-busy aria-label="Mitarbeiter werden geladen">
        <StaffOverviewTableSkeleton />
      </div>
    );
  }
  if (path.startsWith("/dashboard/reservierungen")) {
    return (
      <div className="p-4 md:p-6">
        <ReservationsOverviewSkeleton />
      </div>
    );
  }
  if (path.startsWith("/dashboard/menu")) {
    return <MenuOverviewSkeleton className="p-4 md:p-6" />;
  }
  if (path.startsWith("/dashboard/inventory")) {
    return <InventoryScreenSkeleton className="p-4 md:p-6" />;
  }

  return <GenericModuleContentSkeleton />;
}
