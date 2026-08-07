"use client";

import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { isModuleHomePath } from "@/lib/navigation/module-home-keep-alive";

const DOCUMENTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/dokumente/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/dokumente"],
  },
  {
    href: "/dashboard/dokumente/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/dokumente/protokoll",
    label: "Protokoll",
    matchMode: "exact",
  },
];

export default function DokumenteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {

  const pathname = usePathname();
  if (isModuleHomePath(pathname, "dokumente")) {
    return null;
  }
  return (
    <>
      <RegisterModuleChrome
        title="Dokumente"
        subnavAriaLabel="Dokumente-Bereiche"
        subnavItems={DOCUMENTS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
