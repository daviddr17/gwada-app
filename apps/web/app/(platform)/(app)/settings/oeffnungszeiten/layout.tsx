"use client";

import { ModuleChipNav } from "@/components/layout/module-subnav";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const OPENING_HOURS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/settings/oeffnungszeiten",
    label: "Öffnungszeiten",
    matchMode: "exact",
  },
  {
    href: "/settings/oeffnungszeiten/einbinden",
    label: "Einbinden",
    matchMode: "prefix",
  },
];

export default function SettingsOpeningHoursLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <ModuleChipNav
        items={OPENING_HOURS_NAV}
        aria-label="Öffnungszeiten-Bereiche"
      />
      {children}
    </div>
  );
}
