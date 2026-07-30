"use client";

import { PosMenuSideConfigPanel } from "@/components/pos/pos-menu-side-config-panel";
import { PosRolesDevicesSettingsPanel } from "@/components/pos/pos-roles-devices-settings-panel";

export function PosSettingsDevicesRightsScreen() {
  return (
    <div className="space-y-6">
      <PosRolesDevicesSettingsPanel />
      <PosMenuSideConfigPanel />
    </div>
  );
}
