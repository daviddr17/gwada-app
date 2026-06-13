import { AppShell } from "@/components/layout/app-shell";
import { AppModuleLiveProviders } from "@/components/providers/app-module-live-providers";
import { AuthCookieCleanupMount } from "@/components/providers/auth-cookie-cleanup-mount";
import { DashboardBatchPrefetchMount } from "@/components/providers/dashboard-batch-prefetch-mount";
import { SoftNavCoordinatorProvider } from "@/components/providers/soft-nav-coordinator";
import { QueryProvider } from "@/components/providers/query-provider";
import { ProfilePresenceHeartbeat } from "@/components/providers/profile-presence-heartbeat";
import { AccentColorProvider } from "@/lib/contexts/accent-color-context";
import { DashboardWidgetPreferencesProvider } from "@/lib/contexts/dashboard-widget-preferences-context";
import { RestaurantProfileProvider } from "@/lib/contexts/restaurant-profile-context";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <QueryProvider>
    <RestaurantProfileProvider>
      <DashboardWidgetPreferencesProvider>
        <AccentColorProvider>
          <SoftNavCoordinatorProvider>
            <AuthCookieCleanupMount />
            <DashboardBatchPrefetchMount />
            <ProfilePresenceHeartbeat />
            <AppModuleLiveProviders />
            <AppShell>{children}</AppShell>
          </SoftNavCoordinatorProvider>
        </AccentColorProvider>
      </DashboardWidgetPreferencesProvider>
    </RestaurantProfileProvider>
    </QueryProvider>
  );
}
