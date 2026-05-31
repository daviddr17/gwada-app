"use client";

import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { OAuthChannelIntegrationCard } from "@/components/settings/oauth-channel-integration-card";
import { RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE } from "@/lib/constants/restaurant-integration-messages";

export function InstagramIntegrationCard() {
  return (
    <OAuthChannelIntegrationCard
      provider="instagram"
      title="Instagram"
      description="Verbinde das Instagram-Business-Konto eures Restaurants (über die verknüpfte Facebook-Seite). Später könnt ihr hier auch Direktnachrichten und Beiträge verwalten."
      icon={<InstagramGlyph />}
      permission="integrations.instagram"
      connectLabel="Mit Instagram verbinden"
      disconnectTitle="Instagram trennen?"
      disconnectDescription="Die Verknüpfung wird entfernt. Instagram-Funktionen in Gwada stehen danach nicht mehr zur Verfügung."
      deniedMessage="Deine Position hat keine Berechtigung, Instagram zu verbinden. Bitte wende dich an eine Person mit Administrator-Rechten unter Einstellungen → Rollen."
      noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um Instagram zu verbinden."
      platformNotConfiguredHint={RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE}
    />
  );
}
