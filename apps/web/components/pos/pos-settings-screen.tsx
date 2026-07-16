"use client";

import { PosKdsSettingsPanel } from "@/components/pos/pos-kds-settings-panel";
import { RestaurantFiscalPanel } from "@/components/settings/restaurant-fiscal-panel";

/** POS-Einstellungen: TSE/Fiskal + KDS-Zuordnung. */
export function PosSettingsScreen() {
  return (
    <div className="space-y-6 pt-2">
      <RestaurantFiscalPanel />
      <PosKdsSettingsPanel />
    </div>
  );
}
