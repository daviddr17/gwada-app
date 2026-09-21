"use client";

import { AppScrollUnlockOnNavigate } from "@/components/providers/app-scroll-unlock-on-navigate";
import { AuthCookieCleanupMount } from "@/components/providers/auth-cookie-cleanup-mount";
import { ProfileLocaleSyncMount } from "@/components/providers/profile-locale-sync-mount";
import { ProfilePresenceHeartbeat } from "@/components/providers/profile-presence-heartbeat";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppShellReadinessProvider } from "@/components/providers/app-shell-readiness-provider";
import { WorkspaceShellProviders } from "@/components/providers/workspace-shell-providers";
import { AccentColorProvider } from "@/lib/contexts/accent-color-context";
import { WorkspaceAuthSessionProvider } from "@/lib/contexts/workspace-auth-session-context";
import { SuperadminSPA } from "./SuperadminSPA";

/** Standalone Vite dev — minimale Provider für Superadmin-Zone. */
export function SuperadminStandaloneRoot() {
  return (
    <WorkspaceShellProviders>
      <QueryProvider>
        <WorkspaceAuthSessionProvider>
          <AccentColorProvider>
            <AppShellReadinessProvider>
              <AppScrollUnlockOnNavigate />
              <AuthCookieCleanupMount />
              <ProfilePresenceHeartbeat />
              <ProfileLocaleSyncMount />
              <SuperadminSPA />
            </AppShellReadinessProvider>
          </AccentColorProvider>
        </WorkspaceAuthSessionProvider>
      </QueryProvider>
    </WorkspaceShellProviders>
  );
}
