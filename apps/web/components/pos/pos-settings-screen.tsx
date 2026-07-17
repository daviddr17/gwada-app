"use client";

import { PosCategoryRoutingPanel } from "@/components/pos/pos-category-routing-panel";
import { PosGiftVoucherSettingsPanel } from "@/components/pos/pos-gift-voucher-settings-panel";
import { PosInventorySettingsPanel } from "@/components/pos/pos-inventory-settings-panel";
import { PosKdsSettingsPanel } from "@/components/pos/pos-kds-settings-panel";
import { PosKdsStatusesSettingsPanel } from "@/components/pos/pos-kds-statuses-settings-panel";
import { PosPaymentMethodsSettingsPanel } from "@/components/pos/pos-payment-methods-settings-panel";
import { PosPrintersSettingsPanel } from "@/components/pos/pos-printers-settings-panel";
import { PosVoidReasonsSettingsPanel } from "@/components/pos/pos-void-reasons-settings-panel";
import { RestaurantFiscalPanel } from "@/components/settings/restaurant-fiscal-panel";

/** POS-Einstellungen: TSE/Fiskal, Zahlungsarten, Bondrucker, Bestand, KDS, Storno. */
export function PosSettingsScreen() {
  return (
    <div className="space-y-6 pt-2">
      <RestaurantFiscalPanel />
      <PosPaymentMethodsSettingsPanel />
      <PosPrintersSettingsPanel />
      <PosGiftVoucherSettingsPanel />
      <PosCategoryRoutingPanel />
      <PosInventorySettingsPanel />
      <PosKdsStatusesSettingsPanel />
      <PosVoidReasonsSettingsPanel />
      <PosKdsSettingsPanel />
    </div>
  );
}
