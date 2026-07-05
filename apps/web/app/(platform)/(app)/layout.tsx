import { AppShell } from "@/components/layout/app-shell";
import { AppModuleLiveProviders } from "@/components/providers/app-module-live-providers";
import { AuthCookieCleanupMount } from "@/components/providers/auth-cookie-cleanup-mount";
import { DashboardBatchPrefetchMount } from "@/components/providers/dashboard-batch-prefetch-mount";
import { SoftNavLockProvider } from "@/components/providers/soft-nav-lock-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ProfilePresenceHeartbeat } from "@/components/providers/profile-presence-heartbeat";
import { WorkspaceShellProviders } from "@/components/providers/workspace-shell-providers";
import { AccentColorProvider } from "@/lib/contexts/accent-color-context";
import { DashboardWidgetPreferencesProvider } from "@/lib/contexts/dashboard-widget-preferences-context";
import { RestaurantPermissionsProvider } from "@/lib/contexts/restaurant-permissions-context";
import { RestaurantProfileProvider } from "@/lib/contexts/restaurant-profile-context";
import { WorkspaceAuthSessionProvider } from "@/lib/contexts/workspace-auth-session-context";
import { WorkspaceRestaurantProvider } from "@/lib/contexts/workspace-restaurant-context";
import "../../app-calendar.css";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WorkspaceShellProviders>
      <QueryProvider>
        <WorkspaceAuthSessionProvider>
          <WorkspaceRestaurantProvider>
            <RestaurantPermissionsProvider>
              <RestaurantProfileProvider>
                <DashboardWidgetPreferencesProvider>
                  <AccentColorProvider>
                    <SoftNavLockProvider>
                      <AuthCookieCleanupMount />
                      <DashboardBatchPrefetchMount />
                      <ProfilePresenceHeartbeat />
                      <AppModuleLiveProviders />
                      <AppShell>{children}</AppShell>
                    </SoftNavLockProvider>
                  </AccentColorProvider>
                </DashboardWidgetPreferencesProvider>
              </RestaurantProfileProvider>
            </RestaurantPermissionsProvider>
          </WorkspaceRestaurantProvider>
        </WorkspaceAuthSessionProvider>
      </QueryProvider>
    </WorkspaceShellProviders>
  );
}
