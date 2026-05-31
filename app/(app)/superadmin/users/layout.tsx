"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const USER_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/users",
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: "/superadmin/users/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/superadmin/users/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
];

export default function SuperadminUsersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="User"
        subnavAriaLabel="User-Bereich"
        subnavItems={USER_NAV}
      />
      {children}
    </>
  );
}
