"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardAccountingTile } from "@/components/dashboard/dashboard-accounting-tile";
import { DashboardChecklistsTile } from "@/components/dashboard/dashboard-checklists-tile";
import { DashboardContactsTile } from "@/components/dashboard/dashboard-contacts-tile";
import { DashboardDocumentsTile } from "@/components/dashboard/dashboard-documents-tile";
import { DashboardEventsTile } from "@/components/dashboard/dashboard-events-tile";
import { DashboardGalleryTile } from "@/components/dashboard/dashboard-gallery-tile";
import { DashboardHomePendingSkeleton } from "@/components/dashboard/dashboard-home-pending-skeleton";
import { DashboardHeuteTile } from "@/components/dashboard/dashboard-heute-tile";
import { DashboardInsightsTile } from "@/components/dashboard/dashboard-insights-tile";
import { DashboardIntegrationsTile } from "@/components/dashboard/dashboard-integrations-tile";
import { DashboardInventoryTile } from "@/components/dashboard/dashboard-inventory-tile";
import { DashboardMenuTile } from "@/components/dashboard/dashboard-menu-tile";
import { DashboardMessagesTile } from "@/components/dashboard/dashboard-messages-tile";
import { DashboardNewsTile } from "@/components/dashboard/dashboard-news-tile";
import { DashboardPosTile } from "@/components/dashboard/dashboard-pos-tile";
import { DashboardReservationsTile } from "@/components/dashboard/dashboard-reservations-tile";
import { DashboardReviewsTile } from "@/components/dashboard/dashboard-reviews-tile";
import { DashboardStaffTile } from "@/components/dashboard/dashboard-staff-tile";
import { DashboardWeatherTile } from "@/components/dashboard/dashboard-weather-tile";
import { DashboardWidgetErrorBoundaryWithReset } from "@/components/dashboard/dashboard-widget-error-boundary";
import { DashboardPermissionUnlockCelebration } from "@/components/dashboard/dashboard-permission-unlock-celebration";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import { groupDashboardLayoutSections, groupDashboardMasonryRuns } from "@/lib/dashboard/group-dashboard-layout-sections";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  dashboardWidgetMasonryClassName,
  dashboardWidgetMasonryItemClassName,
  dashboardWidgetStackClassName,
} from "@/lib/ui/dashboard-widget-masonry";

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
    case "pos":
      return <DashboardPosTile />;
    case "events":
      return <DashboardEventsTile />;
    case "news":
      return <DashboardNewsTile />;
    case "insights":
      return <DashboardInsightsTile />;
    case "gallery":
      return <DashboardGalleryTile />;
    case "accounting":
      return <DashboardAccountingTile />;
    case "documents":
      return <DashboardDocumentsTile />;
    case "checklists":
      return <DashboardChecklistsTile />;
    default:
      return null;
  }
}

type DashboardHomePageProps = {
  onOpenArrange?: () => void;
};

export function DashboardHomePage({ onOpenArrange }: DashboardHomePageProps = {}) {
  const {
    visibility,
    order,
    isReady,
    permissionsError,
    reloadPermissions,
  } = useDashboardEffectiveWidgetPrefs();
  // Permissions nicht blockieren: während Loading sind Widgets optimistisch erlaubt
  // (accessOptions.permissionsLoading) — Batch-LS/placeholder kann sofort malen.
  // Nur Widget-Prefs müssen ready sein (meist sync aus LS).
  if (!isReady) {
    return <DashboardHomePendingSkeleton />;
  }

  const orderedVisible = groupDashboardLayoutSections(
    order.filter((id) => visibility[id]),
  );
  const masonryRuns = groupDashboardMasonryRuns(orderedVisible);

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
          Keine Kacheln sichtbar — entweder ausgeblendet oder ohne
          Modulzugriff. Über das Raster-Icon oben kannst du sie anordnen.
        </p>
        {onOpenArrange ? (
          <Button type="button" onClick={onOpenArrange}>
            Dashboard anordnen
          </Button>
        ) : (
          <Button render={<AppNavLink href={APP_ROUTES.settings.dashboard} />}>
            Dashboard-Einstellungen
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <DashboardPermissionUnlockCelebration />
      <div className={dashboardWidgetStackClassName}>
        {masonryRuns.map((run, runIndex) => {
          const cells = run.items.map(({ id, span }) => (
            <div key={id} className={dashboardWidgetMasonryItemClassName(span)}>
              <DashboardWidgetErrorBoundaryWithReset widgetId={id}>
                <DashboardWidgetById id={id} />
              </DashboardWidgetErrorBoundaryWithReset>
            </div>
          ));
          if (run.type === "full") {
            return (
              <div key={`full-${runIndex}`} className="flex min-w-0 flex-col gap-4">
                {cells}
              </div>
            );
          }
          return (
            <div
              key={`columns-${runIndex}`}
              className={dashboardWidgetMasonryClassName}
            >
              {cells}
            </div>
          );
        })}
      </div>
    </>
  );
}
