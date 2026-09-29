"use client";

import { Wallet } from "lucide-react";
import { PaymentAccountConnectCard } from "@/components/settings/payment-account-connect-card";
import { MOLLIE_PLATFORM_NOT_READY_MESSAGE } from "@/lib/integrations/mollie-connect";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";

export function MollieIntegrationCard() {
  return (
    <PaymentAccountConnectCard
      provider="mollie"
      title="Mollie"
      description="Eigenes Mollie-Konto verbinden. Spätere Zahlungen können dort eingehen. Es wird nichts abgebucht."
      icon={<Wallet className="size-5" />}
      accentColor={INTEGRATION_PANEL_ACCENT.mollie}
      permission="integrations.mollie"
      notReadyMessage={MOLLIE_PLATFORM_NOT_READY_MESSAGE}
      disconnectTitle="Mollie trennen?"
      disconnectDescription="Die Verknüpfung zu eurem Mollie-Konto wird entfernt. Es wird nichts abgebucht."
      deniedMessage="Deine Position darf Mollie nicht verbinden. Bitte wende dich an eine Person mit Administrator-Rechten."
      noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um Mollie zu verbinden."
    />
  );
}
