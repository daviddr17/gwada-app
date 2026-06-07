"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { OAuthChannelIntegrationCard } from "@/components/settings/oauth-channel-integration-card";
import { RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE } from "@/lib/constants/restaurant-integration-messages";

export function FacebookIntegrationCard() {
  return (
    <OAuthChannelIntegrationCard
      provider="facebook"
      title="Facebook"
      description="Verbinde die Facebook-Seite eures Restaurants, um Messenger-Nachrichten in Gwada zu empfangen und zu beantworten. Weitere Funktionen wie Beiträge folgen schrittweise."
      icon={<FacebookGlyph />}
      permission="integrations.facebook"
      connectLabel="Mit Facebook verbinden"
      disconnectTitle="Facebook trennen?"
      disconnectDescription="Messenger-Nachrichten über Gwada sind danach nicht mehr möglich, bis ihr die Seite erneut verbindet."
      deniedMessage="Deine Position hat keine Berechtigung, Facebook zu verbinden. Bitte wende dich an eine Person mit Administrator-Rechten unter Einstellungen → Rollen."
      noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um Facebook zu verbinden."
      platformNotConfiguredHint={RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE}
    />
  );
}
