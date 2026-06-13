"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { AppMain } from "@/components/layout/app-main";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { endSoftNavFlight } from "@/lib/navigation/soft-nav-flight-guard";

export { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

function DashboardHomeShell({
  children,
  messagesEnabled,
}: Readonly<{
  children: React.ReactNode;
  messagesEnabled: boolean;
}>) {
  useDashboardPageBackgroundRefresh();

  return (
    <>
      <DashboardBatchQuerySync />
      <UnifiedInboxBackgroundSyncMount enabled={messagesEnabled} />
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

/**
 * Stabiles Dashboard-Zone-Layout: Home-Chrome am Zone-Layout, kein Warm-Layer —
 * versteckte Widget-Bäume + parallele RSC-Flights haben auf Live Router-Fehler ausgelöst.
 */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { visibility } = useDashboardWidgetPreferences();

  useEffect(() => {
    endSoftNavFlight(pathname);
  }, [pathname]);

  if (isDashboardHomePath(pathname)) {
    return (
      <DashboardHomeShell messagesEnabled={visibility.messages}>
        {children}
      </DashboardHomeShell>
    );
  }

  return children;
}
