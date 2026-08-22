"use client";

import { SettingsIntegrationenClient } from "@/app/(platform)/(app)/dashboard/settings/integrationen/settings-integrationen-client";
import { usePlatformMessagingFlags } from "@/lib/hooks/use-platform-messaging-flags";

export function SettingsIntegrationenRoute() {
  const initialPlatformFlags = usePlatformMessagingFlags();
  return (
    <SettingsIntegrationenClient
      initialPlatformFlags={initialPlatformFlags}
    />
  );
}
