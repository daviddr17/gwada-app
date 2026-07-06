"use client";

import { ModuleChipNav } from "@/components/layout/module-subnav";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

const OPENING_HOURS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.settings.openingHours,
    label: "Öffnungszeiten",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.settings.openingHoursEmbed,
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
