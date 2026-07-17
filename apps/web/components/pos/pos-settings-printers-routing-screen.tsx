"use client";

import { PosCategoryRoutingPanel } from "@/components/pos/pos-category-routing-panel";
import { PosPrintersSettingsPanel } from "@/components/pos/pos-printers-settings-panel";

export function PosSettingsPrintersRoutingScreen() {
  return (
    <div className="space-y-6">
      <PosPrintersSettingsPanel />
      <PosCategoryRoutingPanel />
    </div>
  );
}
