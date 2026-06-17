"use client";

import { PlatformAppGeneralPanel } from "@/components/superadmin/platform-app-general-panel";
import { PlatformSidebarModuleOrderPanel } from "@/components/superadmin/platform-sidebar-module-order-panel";
import { SuperadminPlatformStatusSummary } from "@/components/superadmin/superadmin-platform-status-summary";

export default function SuperadminAllgemeinPage() {
  return (
    <div className="space-y-6 pt-2">
      <SuperadminPlatformStatusSummary />
      <PlatformAppGeneralPanel />
      <PlatformSidebarModuleOrderPanel />
    </div>
  );
}
