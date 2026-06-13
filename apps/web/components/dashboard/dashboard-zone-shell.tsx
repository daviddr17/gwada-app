"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { DashboardHomePage } from "@/components/dashboard/dashboard-home-page";
import { AppMain } from "@/components/layout/app-main";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { cn } from "@/lib/utils";

function normalizeDashboardPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isDashboardHomePath(pathname: string): boolean {
  return normalizeDashboardPath(pathname) === "/dashboard";
}

function DashboardHomeWarmLayer({
  visible,
  messagesEnabled,
}: Readonly<{
  visible: boolean;
  messagesEnabled: boolean;
}>) {
  useDashboardPageBackgroundRefresh(visible);

  return (
    <div className={cn(!visible && "hidden")} aria-hidden={!visible}>
      <DashboardBatchQuerySync />
      <UnifiedInboxBackgroundSyncMount
        enabled={visible && messagesEnabled}
      />
      {visible ? (
        <RegisterModuleChrome
          title="Dashboard"
          subnavAriaLabel={null}
          subnavItems={null}
        />
      ) : null}
      <AppMain>
        <DashboardHomePage />
      </AppMain>
      {visible ? <DashboardFab /> : null}
    </div>
  );
}

/**
 * Dashboard-Home bleibt nach erstem Besuch gemountet (nur ausgeblendet in Modulen).
 * Soft-Nav zurück auf `/dashboard` toggelt Sichtbarkeit statt Widget-Tree + RSC neu zu laden.
 */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = isDashboardHomePath(pathname);
  const { visibility } = useDashboardWidgetPreferences();
  const homeEverVisitedRef = useRef(isHome);
  if (isHome) {
    homeEverVisitedRef.current = true;
  }
  const homeWarm = homeEverVisitedRef.current;

  useEffect(() => {
    if (isHome || !pathname.startsWith("/dashboard/")) return;
    router.prefetch("/dashboard");
  }, [isHome, pathname, router]);

  return (
    <>
      {homeWarm ? (
        <DashboardHomeWarmLayer
          visible={isHome}
          messagesEnabled={visibility.messages}
        />
      ) : null}
      {isHome ? null : children}
    </>
  );
}
