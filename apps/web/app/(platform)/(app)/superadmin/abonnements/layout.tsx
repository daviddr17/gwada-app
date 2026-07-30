"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const ABONNEMENTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/abonnements",
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: "/superadmin/abonnements/zahlungen",
    label: "Zahlungen",
    matchMode: "exact",
  },
  {
    href: "/superadmin/abonnements/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
];

export default function SuperadminAbonnementsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Abonnements"
        subnavAriaLabel="Abonnements-Bereich"
        subnavItems={ABONNEMENTS_NAV}
      />
      {children}
    </>
  );
}
