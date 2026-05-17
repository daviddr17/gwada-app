"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const WORKSPACE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/workspace/restaurants",
    label: "Restaurants",
    matchMode: "prefix",
  },
  {
    href: "/workspace/team",
    label: "Team",
    matchMode: "prefix",
  },
];

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Meine Restaurants"
        subnavAriaLabel="Meine Restaurants"
        subnavItems={WORKSPACE_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
