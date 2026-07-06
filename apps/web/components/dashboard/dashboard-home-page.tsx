"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardWidgetErrorBoundaryWithReset } from "@/components/dashboard/dashboard-widget-error-boundary";
import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";
import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import { groupDashboardLayoutSections } from "@/lib/dashboard/group-dashboard-layout-sections";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { cn } from "@/lib/utils";

const dynamicTile = (
  loader: () => Promise<{ default: React.ComponentType }>,
) =>
  dynamic(loader, { loading: () => <DashboardWidgetTileSkeleton /> });

const DashboardHeuteTile = dynamicTile(() =>
  import("@/components/dashboard/dashboard-heute-tile").then((m) => ({
    default: m.DashboardHeuteTile,
  })),
);
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
    case "heute":
      return <DashboardHeuteTile />;
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

function DashboardHomeSkeleton() {
  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-2" aria-busy="true" aria-label="Dashboard wird geladen">
      <DashboardWidgetTileSkeleton />
      <DashboardWidgetTileSkeleton />
      <DashboardWidgetTileSkeleton />
      <DashboardWidgetTileSkeleton />
    </div>
  );
}

export function DashboardHomePage() {
  const {
    visibility,
    order,
    isReady,
    permissionsLoading,
    permissionsError,
    reloadPermissions,
  } = useDashboardEffectiveWidgetPrefs();

  const prefsLoading = !isReady || permissionsLoading;

  if (prefsLoading) {
    return <DashboardHomeSkeleton />;
  }

  const orderedVisible = groupDashboardLayoutSections(
    order.filter((id) => visibility[id]),
  );

  const anyWidget = orderedVisible.length > 0;

  if (permissionsError && !anyWidget) {
    return (
      <div className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Berechtigungen konnten gerade nicht geladen werden — oft nur kurz nach
          einem Update. Bitte erneut versuchen.
        </p>
        <Button
          type="button"
          className="gap-2"
          onClick={() => void reloadPermissions()}
        >
          <RefreshCw className="size-4" aria-hidden />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (!anyWidget) {
    return (
      <div className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Für das Dashboard sind aktuell keine Widgets sichtbar — entweder sind
          sie deaktiviert oder deine Position hat keinen Lesezugriff auf die
          zugehörigen Module. Unter Einstellungen kannst du Widgets einblenden,
          sofern sie für deine Rolle verfügbar sind.
        </p>
        <Button render={<Link href="/settings/dashboard" prefetch />}>
          Dashboard-Einstellungen
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-2">
      {orderedVisible.map(({ id, span }) => (
        <div
          key={id}
          className={cn("min-w-0", span === 2 && "lg:col-span-2")}
        >
          <DashboardWidgetErrorBoundaryWithReset widgetId={id}>
            <DashboardWidgetById id={id} />
          </DashboardWidgetErrorBoundaryWithReset>
        </div>
      ))}
    </div>
  );
}
