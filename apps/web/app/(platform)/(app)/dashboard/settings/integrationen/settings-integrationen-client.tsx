"use client";

import { Suspense, useCallback, useState } from "react";
import { EmailIntegrationCard } from "@/components/settings/email-integration-card";
import { AppleBusinessConnectIntegrationCard } from "@/components/settings/apple-business-connect-integration-card";
import { FacebookIntegrationCard } from "@/components/settings/facebook-integration-card";
import { GoogleBusinessIntegrationCard } from "@/components/settings/google-business-integration-card";
import { LexofficeIntegrationCard } from "@/components/settings/lexoffice-integration-card";
import { InstagramIntegrationCard } from "@/components/settings/instagram-integration-card";
import { TripadvisorIntegrationCard } from "@/components/settings/tripadvisor-integration-card";
import { IntegrationenSettingsSkeleton } from "@/components/settings/integrationen-settings-skeleton";
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
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { usePlatformMessagingFlags } from "@/lib/hooks/use-platform-messaging-flags";
import { isMetaReviewDemoRestaurantSlug } from "@/lib/restaurants/meta-review-demo";
import { cn } from "@/lib/utils";

function IntegrationenContent() {
  const { profile } = useRestaurantProfile();
  const hideWhatsappForMetaReview = isMetaReviewDemoRestaurantSlug(profile.slug);
  const {
    whatsappEnabled,
    emailEnabled,
    facebookEnabled,
    instagramEnabled,
    googleBusinessEnabled,
    lexofficeEnabled,
    tripadvisorEnabled,
    appleBusinessConnectEnabled,
    loading,
  } = usePlatformMessagingFlags();
  const showSkeleton = useDeferredSkeleton(loading);
  const { dirty, saving, saveAll } = useSettingsIntegrationSave();
  const [emailReload, setEmailReload] = useState(0);

  const onEmailSaved = useCallback(() => {
    setEmailReload((n) => n + 1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-48" aria-busy>
        {showSkeleton ? <IntegrationenSettingsSkeleton /> : null}
      </div>
    );
  }

  const anyEnabled =
    (whatsappEnabled && !hideWhatsappForMetaReview) ||
    emailEnabled ||
    facebookEnabled ||
    instagramEnabled ||
    googleBusinessEnabled ||
    lexofficeEnabled ||
    tripadvisorEnabled ||
    appleBusinessConnectEnabled;

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
        {whatsappEnabled && !hideWhatsappForMetaReview ? (
          <WhatsappIntegrationCard />
        ) : null}
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
        {lexofficeEnabled ? <LexofficeIntegrationCard /> : null}
        {tripadvisorEnabled ? <TripadvisorIntegrationCard /> : null}
        {appleBusinessConnectEnabled ? <AppleBusinessConnectIntegrationCard /> : null}
      </div>

      {emailEnabled || lexofficeEnabled || tripadvisorEnabled || appleBusinessConnectEnabled ? (
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

export function SettingsIntegrationenClient() {
  return (
    <SettingsIntegrationSaveProvider>
      <IntegrationenContent />
    </SettingsIntegrationSaveProvider>
  );
}
