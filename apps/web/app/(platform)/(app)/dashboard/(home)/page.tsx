"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";
import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import { groupDashboardLayoutSections } from "@/lib/dashboard/group-dashboard-layout-sections";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";

const dynamicTile = (
  loader: () => Promise<{ default: React.ComponentType }>,
) =>
  dynamic(loader, { loading: () => <DashboardWidgetTileSkeleton /> });

const DashboardContactsTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-contacts-tile").then((m) => ({
    default: m.DashboardContactsTile,
  })),
);
const DashboardMessagesTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-messages-tile").then((m) => ({
    default: m.DashboardMessagesTile,
  })),
);
const DashboardIntegrationsTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-integrations-tile").then((m) => ({
    default: m.DashboardIntegrationsTile,
  })),
);
const DashboardInventoryTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-inventory-tile").then((m) => ({
    default: m.DashboardInventoryTile,
  })),
);
const DashboardMenuTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-menu-tile").then((m) => ({
    default: m.DashboardMenuTile,
  })),
);
const DashboardStaffTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-staff-tile").then((m) => ({
    default: m.DashboardStaffTile,
  })),
);
const DashboardReservationsTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-reservations-tile").then((m) => ({
    default: m.DashboardReservationsTile,
  })),
);
const DashboardReviewsTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-reviews-tile").then((m) => ({
    default: m.DashboardReviewsTile,
  })),
);
const DashboardWeatherTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-weather-tile").then((m) => ({
    default: m.DashboardWeatherTile,
  })),
);

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
  const { visibility, order } = useDashboardWidgetPreferences();

  const orderedVisible = groupDashboardLayoutSections(
    order.filter((id) => visibility[id]),
  );

  const anyWidget = orderedVisible.length > 0;

  if (!anyWidget) {
    return (
      <div className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Für das Dashboard sind aktuell keine Widgets aktiviert. Unter
          Einstellungen kannst du Speisekarte, Reservierungen, Bewertungen,
          Mitarbeiter, Wetter, Nachrichten, Integrationen und Bestand wieder
          einblenden.
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
