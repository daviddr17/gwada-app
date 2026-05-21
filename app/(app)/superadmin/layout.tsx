"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { SuperadminGuard } from "@/components/superadmin/superadmin-guard";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const SUPERADMIN_CHIP: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin",
    label: "Superadmin — Dashboard",
    matchMode: "prefix",
  },
];

export default function SuperadminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SuperadminGuard>
      <RegisterModuleChrome
        title="Superadmin"
        subnavAriaLabel="Superadmin-Bereich"
        subnavItems={SUPERADMIN_CHIP}
      />
      <AppMain>{children}</AppMain>
    </SuperadminGuard>
  );
}
