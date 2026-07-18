"use client";

import { PosKdsSettingsPanel } from "@/components/pos/pos-kds-settings-panel";
import { PosKdsStatusesSettingsPanel } from "@/components/pos/pos-kds-statuses-settings-panel";

export function PosSettingsKitchenScreen() {
  return (
    <div className="space-y-6">
      <PosKdsSettingsPanel />
      <PosKdsStatusesSettingsPanel />
    </div>
  );
}
