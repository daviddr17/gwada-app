"use client";

import { AppMain } from "@/components/layout/app-main";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";

export default function DashboardHomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  useDashboardPageBackgroundRefresh();

  return (
    <>
      <UnifiedInboxBackgroundSyncMount />
      <RegisterModuleChrome
        title="Dashboard"
        subnavAriaLabel={null}
        subnavItems={null}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
