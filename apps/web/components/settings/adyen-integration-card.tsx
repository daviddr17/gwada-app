"use client";

import { Landmark } from "lucide-react";
import { PaymentAccountConnectCard } from "@/components/settings/payment-account-connect-card";
import { ADYEN_PLATFORM_NOT_READY_MESSAGE } from "@/lib/integrations/adyen-connect";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";

export function AdyenIntegrationCard() {
  return (
    <PaymentAccountConnectCard
      provider="adyen"
      title="Adyen"
      description="Eigenes Adyen-Konto über die gehostete Anmeldung von Adyen verbinden. Das Geld bleibt beim Restaurant. Es wird nichts abgebucht."
      icon={<Landmark className="size-5" />}
      accentColor={INTEGRATION_PANEL_ACCENT.adyen}
      permission="integrations.adyen"
      notReadyMessage={ADYEN_PLATFORM_NOT_READY_MESSAGE}
      disconnectTitle="Adyen trennen?"
      disconnectDescription="Die Verknüpfung zu eurem Adyen-Konto wird in Gwada gelöst. Es wird nichts abgebucht."
      deniedMessage="Deine Position darf Adyen nicht verbinden. Bitte wende dich an eine Person mit Administrator-Rechten."
      noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um Adyen zu verbinden."
    />
  );
}
