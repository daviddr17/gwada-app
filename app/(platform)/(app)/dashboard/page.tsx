"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCardFrame } from "@/components/ui/skeleton";
import { DashboardContactsTile } from "@/components/dashboard/dashboard-contacts-tile";
import { DashboardMessagesTile } from "@/components/dashboard/dashboard-messages-tile";
import { DashboardIntegrationsTile } from "@/components/dashboard/dashboard-integrations-tile";
import { DashboardInventoryTile } from "@/components/dashboard/dashboard-inventory-tile";
import { DashboardMenuTile } from "@/components/dashboard/dashboard-menu-tile";
import { DashboardStaffTile } from "@/components/dashboard/dashboard-staff-tile";
import { DashboardReservationsTile } from "@/components/dashboard/dashboard-reservations-tile";
import { DashboardReviewsTile } from "@/components/dashboard/dashboard-reviews-tile";
import { DashboardWeatherTile } from "@/components/dashboard/dashboard-weather-tile";
import { DashboardWidgetStatsSkeleton } from "@/components/dashboard/dashboard-stat-block";
import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import { groupDashboardLayoutSections } from "@/lib/dashboard/group-dashboard-layout-sections";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";

function DashboardWidgetSkeleton() {
  return (
    <SkeletonCardFrame className="min-w-0 border-border/50 shadow-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="px-4 pb-4">
        <DashboardWidgetStatsSkeleton compact />
      </div>
    </SkeletonCardFrame>
  );
}

function DashboardWidgetById({ id }: { id: DashboardWidgetId }) {
  switch (id) {
    case "menu":
      return <DashboardMenuTile />;
    case "reservations":
      return <DashboardReservationsTile />;
    case "reviews":
      return <DashboardReviewsTile />;
    case "staff":
      return <DashboardStaffTile />;
    case "weather":
      return <DashboardWeatherTile />;
    case "contacts":
      return <DashboardContactsTile />;
    case "messages":
      return <DashboardMessagesTile />;
    case "integrations":
      return <DashboardIntegrationsTile />;
    case "inventory":
      return <DashboardInventoryTile />;
    default:
      return null;
  }
}

export default function DashboardPage() {
  const { visibility, order, isReady: widgetsReady } =
    useDashboardWidgetPreferences();

  const orderedVisible = groupDashboardLayoutSections(
    order.filter((id) => visibility[id]),
  );

  const anyWidget = orderedVisible.length > 0;

  if (!widgetsReady) {
    return (
      <div className="grid gap-4 pt-2 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <DashboardWidgetSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!anyWidget) {
    return (
      <div className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Für das Dashboard sind aktuell keine Widgets aktiviert. Unter
          Einstellungen kannst du           Speisekarte, Reservierungen, Bewertungen, Mitarbeiter, Wetter, Kontakte,
          Nachrichten, Integrationen und Bestand wieder einblenden.
        </p>
        <Button render={<Link href="/settings/dashboard" prefetch />}>
          Dashboard-Einstellungen
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-2">
      {orderedVisible.map((id) => (
        <div key={id} className="min-w-0">
          <DashboardWidgetById id={id} />
        </div>
      ))}
    </div>
  );
}
