"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { DashboardHomePage } from "@/components/dashboard/dashboard-home-page";
import { AppMain } from "@/components/layout/app-main";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { endSoftNavFlight } from "@/lib/navigation/soft-nav-flight-guard";
import { cn } from "@/lib/utils";

export { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

function DashboardHomeShell({
  messagesEnabled,
}: Readonly<{
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
      <AppMain>
        <DashboardHomePage />
      </AppMain>
      <DashboardFab />
    </>
  );
}

/**
 * Home-UI aus dem Zone-Shell (pathname), Page-Segment bleibt als null-Anker gemountet —
 * minimaler RSC-Payload + Router-Sync (kein Warm-Layer in anderen Modulen).
 */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isHome = isDashboardHomePath(pathname);
  const { visibility } = useDashboardWidgetPreferences();

  useEffect(() => {
    endSoftNavFlight(pathname);
  }, [pathname]);

  if (isHome) {
    return (
      <>
        <DashboardHomeShell messagesEnabled={visibility.messages} />
        <div className={cn("hidden")} aria-hidden>
          {children}
        </div>
      </>
    );
  }

  return children;
}
