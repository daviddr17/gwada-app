"use client";

import { usePathname } from "next/navigation";
import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { AppMain } from "@/components/layout/app-main";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";

function normalizeDashboardPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isDashboardHomePath(pathname: string): boolean {
  return normalizeDashboardPath(pathname) === "/dashboard";
}

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
 * Stabiles Dashboard-Zone-Layout: Home-Chrome hängt am Zone-Layout statt an der
 * `(home)`-Route-Group — beim Modul→Dashboard-Wechsel kein Layout-Segment-Tausch.
 */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { visibility } = useDashboardWidgetPreferences();

  if (isDashboardHomePath(pathname)) {
    return (
      <DashboardHomeShell messagesEnabled={visibility.messages}>
        {children}
      </DashboardHomeShell>
    );
  }

  return children;
}
