"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { GalleryScreen } from "@/components/gallery/gallery-screen";
import { GALLERY_MODULE_NAV } from "@/components/gallery/gallery-module-nav";

export function GalleryOverviewKeepAliveScreen({
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
      title="Galerie"
      subnavAriaLabel="Galerie-Bereiche"
      subnavItems={GALLERY_MODULE_NAV}
    >
      <GalleryScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
