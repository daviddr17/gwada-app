"use client";

import { PosCategoryRoutingPanel } from "@/components/pos/pos-category-routing-panel";
import { PosKdsSettingsPanel } from "@/components/pos/pos-kds-settings-panel";
import { PosPrintersSettingsPanel } from "@/components/pos/pos-printers-settings-panel";
import { RestaurantFiscalPanel } from "@/components/settings/restaurant-fiscal-panel";

/** POS-Einstellungen: TSE/Fiskal, Bondrucker, Kategorie-Routing, KDS. */
export function PosSettingsScreen() {
  return (
    <div className="space-y-6 pt-2">
      <RestaurantFiscalPanel />
      <PosPrintersSettingsPanel />
      <PosCategoryRoutingPanel />
      <PosKdsSettingsPanel />
    </div>
  );
}
