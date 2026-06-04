"use client";

import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardLiveNotifications } from "@/lib/hooks/use-dashboard-live-notifications";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  useDashboardLiveNotifications();
  useDashboardPageBackgroundRefresh();

  return (
    <>
      <RegisterModuleChrome
        title="Dashboard"
        subnavAriaLabel={null}
        subnavItems={null}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
