"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { DocumentsOverview } from "@/components/documents/documents-overview";
import { DOCUMENTS_MODULE_NAV } from "@/components/documents/documents-module-nav";

export function DocumentsOverviewKeepAliveScreen({
  active,
  showChrome = active,
}: {
  active: boolean;
  showChrome?: boolean;
}) {
  return (
    <ModuleHomeKeepAliveShell
      active={active}
      showChrome={showChrome}
      title="Dokumente"
      subnavAriaLabel="Dokumente-Bereiche"
      subnavItems={DOCUMENTS_MODULE_NAV}
    >
      <DocumentsOverview active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
