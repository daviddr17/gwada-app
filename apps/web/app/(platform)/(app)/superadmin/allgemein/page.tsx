"use client";

import { PlatformAppGeneralPanel } from "@/components/superadmin/platform-app-general-panel";
import { PlatformSidebarModuleOrderPanel } from "@/components/superadmin/platform-sidebar-module-order-panel";

export default function SuperadminAllgemeinPage() {
  return (
    <div className="space-y-6 pt-2">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Plattformweite Darstellung: Name, Logo und Favicon für Tab und
          öffentliche Seiten.
        </p>
        <PlatformAppGeneralPanel />
      </div>
      <PlatformSidebarModuleOrderPanel />
    </div>
  );
}
