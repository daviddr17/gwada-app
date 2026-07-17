"use client";

import { PosPaymentMethodsSettingsPanel } from "@/components/pos/pos-payment-methods-settings-panel";
import { RestaurantFiscalPanel } from "@/components/settings/restaurant-fiscal-panel";

export function PosSettingsFiscalPaymentScreen() {
  return (
    <div className="space-y-6">
      <RestaurantFiscalPanel />
      <PosPaymentMethodsSettingsPanel />
    </div>
  );
}
