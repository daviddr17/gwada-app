"use client";

import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { DashboardHomePage } from "@/components/dashboard/dashboard-home-page";
import { AppMain } from "@/components/layout/app-main";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";

/** Dashboard-Home — Page-Segment `/dashboard` (RSC/Router-Sync). */
export function DashboardHomeScreen() {
  useDashboardPageBackgroundRefresh();

  return (
    <>
      <DashboardBatchQuerySync />
      <RegisterModuleChrome
        title="Dashboard"
        subnavAriaLabel={null}
        subnavItems={null}
      />
      <AppMain>
        <DashboardHomePage />
      </AppMain>
      <DashboardFab />
    </>
  );
}
