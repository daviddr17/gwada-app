"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { DocumentsOverview } from "@/components/documents/documents-overview";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const DOCUMENTS_NAV: readonly ModuleSubnavItem[] = [
  { href: "/dashboard/dokumente/uebersicht", label: "Übersicht", matchMode: "exact", activeWhen: ["/dashboard/dokumente"] },
  { href: "/dashboard/dokumente/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/dokumente/protokoll", label: "Protokoll", matchMode: "exact" },
];

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
      subnavItems={DOCUMENTS_NAV}
    >
      <DocumentsOverview active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
