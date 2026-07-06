import type { Metadata, Viewport } from "next";
import { DashboardPwaSetup } from "@/components/dashboard/dashboard-pwa-setup";
import { AppShell } from "@/components/layout/app-shell";
import { AppDashboardLivePatchMount } from "@/components/providers/app-dashboard-live-patch-mount";
import { AppModuleLiveProviders } from "@/components/providers/app-module-live-providers";
import { AppModuleWarmPrefetchMount } from "@/components/providers/app-module-warm-prefetch-mount";
import { AuthCookieCleanupMount } from "@/components/providers/auth-cookie-cleanup-mount";
import { DashboardBatchPrefetchMount } from "@/components/providers/dashboard-batch-prefetch-mount";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
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
import {
  DASHBOARD_PWA_MANIFEST_PATH,
  dashboardPwaIconPath,
} from "@/lib/dashboard/dashboard-pwa-config";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import "../../app-calendar.css";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getCachedRootLayoutBranding();
  const appName = branding.appName.trim() || "gwada";
  const dashboardAppName = `${appName} - Dashboard`;

  return {
    manifest: DASHBOARD_PWA_MANIFEST_PATH,
    appleWebApp: {
      capable: true,
      title: dashboardAppName,
      statusBarStyle: "default",
    },
    icons: {
      apple: [{ url: dashboardPwaIconPath(180), sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

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
                      <DashboardPwaSetup />
                      <AuthCookieCleanupMount />
                      <DashboardBatchPrefetchMount />
                      <AppModuleWarmPrefetchMount />
                      <UnifiedInboxBackgroundSyncMount />
                      <AppDashboardLivePatchMount />
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
