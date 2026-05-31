"use client";

import { Suspense, useCallback, useState } from "react";
import { EmailIntegrationCard } from "@/components/settings/email-integration-card";
import { FacebookIntegrationCard } from "@/components/settings/facebook-integration-card";
import { GoogleBusinessIntegrationCard } from "@/components/settings/google-business-integration-card";
import { InstagramIntegrationCard } from "@/components/settings/instagram-integration-card";
import { WhatsappIntegrationCard } from "@/components/settings/whatsapp-integration-card";
import {
  SettingsIntegrationSaveProvider,
  useSettingsIntegrationSave,
} from "@/components/settings/settings-integration-save-registry";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { Button } from "@/components/ui/button";
import { usePlatformMessagingFlags } from "@/lib/hooks/use-platform-messaging-flags";
import type { PlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import { cn } from "@/lib/utils";

function IntegrationenContent({
  initialPlatformFlags,
}: {
  initialPlatformFlags: PlatformMessagingFlags;
}) {
  const {
    whatsappEnabled,
    emailEnabled,
    facebookEnabled,
    instagramEnabled,
    googleBusinessEnabled,
    loading,
  } = usePlatformMessagingFlags(initialPlatformFlags);
  const { dirty, saving, saveAll } = useSettingsIntegrationSave();
  const [emailReload, setEmailReload] = useState(0);

  const onEmailSaved = useCallback(() => {
    setEmailReload((n) => n + 1);
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground" aria-busy>
        Integrationen werden geladen…
      </p>
    );
  }

  const anyEnabled =
    whatsappEnabled ||
    emailEnabled ||
    facebookEnabled ||
    instagramEnabled ||
    googleBusinessEnabled;

  if (!anyEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Derzeit sind keine Integrationen für euer Restaurant freigeschaltet.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {whatsappEnabled ? <WhatsappIntegrationCard /> : null}
        {facebookEnabled ? (
          <Suspense fallback={null}>
            <FacebookIntegrationCard />
          </Suspense>
        ) : null}
        {instagramEnabled ? (
          <Suspense fallback={null}>
            <InstagramIntegrationCard />
          </Suspense>
        ) : null}
        {googleBusinessEnabled ? (
          <Suspense fallback={null}>
            <GoogleBusinessIntegrationCard />
          </Suspense>
        ) : null}
        {emailEnabled ? (
          <EmailIntegrationCard key={emailReload} onSaved={onEmailSaved} />
        ) : null}
      </div>

      {emailEnabled ? (
        <SettingsStickySaveBar show={dirty}>
          <Button
            type="button"
            disabled={saving}
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
            onClick={() => void saveAll()}
          >
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </SettingsStickySaveBar>
      ) : null}
    </>
  );
}

export function SettingsIntegrationenClient({
  initialPlatformFlags,
}: {
  initialPlatformFlags: PlatformMessagingFlags;
}) {
  return (
    <SettingsIntegrationSaveProvider>
      <IntegrationenContent initialPlatformFlags={initialPlatformFlags} />
    </SettingsIntegrationSaveProvider>
  );
}
