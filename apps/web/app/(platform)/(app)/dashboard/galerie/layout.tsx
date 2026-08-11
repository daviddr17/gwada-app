"use client";

import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { isModuleHomePath } from "@/lib/navigation/module-home-keep-alive";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const GALLERY_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/galerie/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/galerie"],
  },
  {
    href: "/dashboard/galerie/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/galerie/einbinden",
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/galerie/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];

export default function GalerieLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();
  if (isModuleHomePath(pathname, "galerie")) {
    return null;
  }
  return (
    <>
      <RegisterModuleChrome
        title="Galerie"
        subnavAriaLabel="Galerie-Bereiche"
        subnavItems={GALLERY_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
