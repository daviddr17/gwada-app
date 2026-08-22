"use client";

import { DashboardPwaSetup } from "@/components/dashboard/dashboard-pwa-setup";
import { AppDashboardLivePatchMount } from "@/components/providers/app-dashboard-live-patch-mount";
import { AppModuleLiveProviders } from "@/components/providers/app-module-live-providers";
import { AppModuleWarmPrefetchMount } from "@/components/providers/app-module-warm-prefetch-mount";
import { AppShellReadinessProvider } from "@/components/providers/app-shell-readiness-provider";
import { AuthCookieCleanupMount } from "@/components/providers/auth-cookie-cleanup-mount";
import { DashboardBatchPrefetchMount } from "@/components/providers/dashboard-batch-prefetch-mount";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { AppScrollUnlockOnNavigate } from "@/components/providers/app-scroll-unlock-on-navigate";
import { ProfileLocaleSyncMount } from "@/components/providers/profile-locale-sync-mount";
import { ProfilePresenceHeartbeat } from "@/components/providers/profile-presence-heartbeat";
import { QueryProvider } from "@/components/providers/query-provider";
import { PersonalOnboardingProvider } from "@/components/onboarding/personal-onboarding-provider";
import { RestaurantSetupWizardProvider } from "@/components/onboarding/restaurant-setup-wizard-provider";
import { WorkspaceShellProviders } from "@/components/providers/workspace-shell-providers";
import { AccentColorProvider } from "@/lib/contexts/accent-color-context";
import { DashboardWidgetPreferencesProvider } from "@/lib/contexts/dashboard-widget-preferences-context";
import { RestaurantBillingProvider } from "@/lib/contexts/restaurant-billing-context";
import { RestaurantPermissionsProvider } from "@/lib/contexts/restaurant-permissions-context";
import { RestaurantProfileProvider } from "@/lib/contexts/restaurant-profile-context";
import { WorkspaceAuthSessionProvider } from "@/lib/contexts/workspace-auth-session-context";
import { WorkspaceRestaurantProvider } from "@/lib/contexts/workspace-restaurant-context";
import { DashboardSPA } from "./DashboardSPA";

/** Standalone Vite dev — gleiche Provider wie `(app)/layout`. */
export function DashboardStandaloneRoot() {
  return (
    <WorkspaceShellProviders>
      <QueryProvider>
        <WorkspaceAuthSessionProvider>
          <WorkspaceRestaurantProvider>
            <RestaurantPermissionsProvider>
              <RestaurantBillingProvider>
                <RestaurantProfileProvider>
                  <DashboardWidgetPreferencesProvider>
                    <AccentColorProvider>
                      <RestaurantSetupWizardProvider>
                        <PersonalOnboardingProvider>
                          <AppShellReadinessProvider>
                            <AppScrollUnlockOnNavigate />
                            <DashboardPwaSetup />
                            <AuthCookieCleanupMount />
                            <DashboardBatchPrefetchMount />
                            <AppModuleWarmPrefetchMount />
                            <UnifiedInboxBackgroundSyncMount />
                            <AppDashboardLivePatchMount />
                            <ProfilePresenceHeartbeat />
                            <ProfileLocaleSyncMount />
                            <AppModuleLiveProviders />
                            <DashboardSPA />
                          </AppShellReadinessProvider>
                        </PersonalOnboardingProvider>
                      </RestaurantSetupWizardProvider>
                    </AccentColorProvider>
                  </DashboardWidgetPreferencesProvider>
                </RestaurantProfileProvider>
              </RestaurantBillingProvider>
            </RestaurantPermissionsProvider>
          </WorkspaceRestaurantProvider>
        </WorkspaceAuthSessionProvider>
      </QueryProvider>
    </WorkspaceShellProviders>
  );
}
