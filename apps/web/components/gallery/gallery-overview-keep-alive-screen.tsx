"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { GalleryScreen } from "@/components/gallery/gallery-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const GALLERY_NAV: readonly ModuleSubnavItem[] = [
  { href: "/dashboard/galerie/uebersicht", label: "Übersicht", matchMode: "exact", activeWhen: ["/dashboard/galerie"] },
  { href: "/dashboard/galerie/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/galerie/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/galerie/einstellungen", label: "Einstellungen", matchMode: "prefix" },
];

export function GalleryOverviewKeepAliveScreen({ active }: { active: boolean }) {
  return (
    <ModuleHomeKeepAliveShell
      active={active}
      title="Galerie"
      subnavAriaLabel="Galerie-Bereiche"
      subnavItems={GALLERY_NAV}
    >
      <GalleryScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
