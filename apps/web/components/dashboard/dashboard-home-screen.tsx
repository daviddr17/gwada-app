"use client";

import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { DashboardHomePage } from "@/components/dashboard/dashboard-home-page";
import { AppMain } from "@/components/layout/app-main";
import { PendingStaffInviteBanner } from "@/components/staff/pending-staff-invite-banner";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";

/** Dashboard-Home — Keep-alive unter App-Shell; `active` steuert Arbeit/Chrome/FAB. */
export function DashboardHomeScreen({ active = true }: { active?: boolean }) {
  useDashboardPageBackgroundRefresh(active);

  return (
    <>
      {active ? <DashboardBatchQuerySync /> : null}
      {active ? (
        <RegisterModuleChrome
          title="Dashboard"
          subnavAriaLabel={null}
          subnavItems={null}
        />
      ) : null}
      <AppMain>
        <div className="space-y-4">
          <PendingStaffInviteBanner />
          <DashboardHomePage />
        </div>
      </AppMain>
      {active ? <DashboardFab /> : null}
    </>
  );
}
