"use client";

import { GoogleGlyph } from "@/components/icons/google-glyph";
import { OAuthChannelIntegrationCard } from "@/components/settings/oauth-channel-integration-card";
import { RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE } from "@/lib/constants/restaurant-integration-messages";

export function GoogleBusinessIntegrationCard() {
  return (
    <OAuthChannelIntegrationCard
      provider="google_business"
      title="Google Business Profile"
      description="Verknüpft euer Google-Unternehmensprofil, damit ihr künftig Bewertungen, Nachrichten und Beiträge direkt in Gwada nutzen könnt."
      icon={<GoogleGlyph />}
      permission="integrations.google_business"
      connectLabel="Mit Google verbinden"
      disconnectTitle="Google Business Profile trennen?"
      disconnectDescription="Die Verknüpfung zum Unternehmensprofil wird entfernt."
      deniedMessage="Deine Position hat keine Berechtigung, Google Business zu verbinden. Bitte wende dich an eine Person mit Administrator-Rechten unter Einstellungen → Rollen."
      noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um Google Business zu verbinden."
      platformNotConfiguredHint={RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE}
    />
  );
}
