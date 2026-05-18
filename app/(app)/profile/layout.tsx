"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const PROFILE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/profile/anmeldung",
    label: "Anmeldung",
    matchMode: "exact",
  },
  {
    href: "/profile/persoenliche-daten",
    label: "Persönliche Daten",
    matchMode: "exact",
  },
];

export default function ProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Persönliches Profil"
        subnavAriaLabel="Profilbereiche"
        subnavItems={PROFILE_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
