"use client";

import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { AppMain } from "@/components/layout/app-main";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";

export default function DashboardHomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  useDashboardPageBackgroundRefresh();
  const { visibility } = useDashboardWidgetPreferences();

  return (
    <>
      <DashboardBatchQuerySync />
      <UnifiedInboxBackgroundSyncMount enabled={visibility.messages} />
      <RegisterModuleChrome
        title="Dashboard"
        subnavAriaLabel={null}
        subnavItems={null}
      />
      <AppMain>{children}</AppMain>
      <DashboardFab />
    </>
  );
}
