"use client";

import { useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { DashboardArrangeSheet } from "@/components/dashboard/dashboard-arrange-sheet";
import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { DashboardHomePage } from "@/components/dashboard/dashboard-home-page";
import { AppMain } from "@/components/layout/app-main";
import { PendingStaffInviteBanner } from "@/components/staff/pending-staff-invite-banner";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { Button } from "@/components/ui/button";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";

/** Dashboard-Home — Keep-alive unter App-Shell; `active` steuert Arbeit/FAB, `showChrome` den Header. */
export function DashboardHomeScreen({
  active = true,
  showChrome = active,
}: {
  active?: boolean;
  showChrome?: boolean;
}) {
  useDashboardPageBackgroundRefresh(active);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const prefs = useDashboardWidgetPreferences();
  const { permittedWidgetIds } = useDashboardEffectiveWidgetPrefs();

  const headerActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full border-border/60"
        aria-label="Dashboard anordnen"
        title="Dashboard anordnen"
        onClick={() => setArrangeOpen(true)}
      >
        <LayoutGrid className="size-4" />
      </Button>
    ),
    [],
  );

  return (
    <>
      {active ? <DashboardBatchQuerySync /> : null}
      {showChrome ? (
        <RegisterModuleChrome
          title="Dashboard"
          subnavAriaLabel={null}
          subnavItems={null}
          headerActions={headerActions}
        />
      ) : null}
      <AppMain>
        <div className="space-y-4">
          <PendingStaffInviteBanner />
          <DashboardHomePage onOpenArrange={() => setArrangeOpen(true)} />
        </div>
      </AppMain>
      {active ? <DashboardFab /> : null}

      <DashboardArrangeSheet
        open={arrangeOpen}
        onOpenChange={setArrangeOpen}
        order={prefs.order}
        visibility={prefs.visibility}
        permittedIds={permittedWidgetIds}
        onApply={(next) => prefs.applyWidgetLayout(next)}
      />
    </>
  );
}
