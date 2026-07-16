"use client";

import { RestaurantFiscalPanel } from "@/components/settings/restaurant-fiscal-panel";

/** POS-Einstellungen: TSE / Fiskalisierung (bisher unter Settings → Kasse). */
export function PosSettingsScreen() {
  return (
    <div className="space-y-6 pt-2">
      <RestaurantFiscalPanel />
    </div>
  );
}
