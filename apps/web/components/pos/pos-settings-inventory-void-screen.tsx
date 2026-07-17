"use client";

import { PosInventorySettingsPanel } from "@/components/pos/pos-inventory-settings-panel";
import { PosVoidReasonsSettingsPanel } from "@/components/pos/pos-void-reasons-settings-panel";

export function PosSettingsInventoryVoidScreen() {
  return (
    <div className="space-y-6">
      <PosInventorySettingsPanel />
      <PosVoidReasonsSettingsPanel />
    </div>
  );
}
