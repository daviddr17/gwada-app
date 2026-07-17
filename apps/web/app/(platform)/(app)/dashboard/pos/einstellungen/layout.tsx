"use client";

import { ModuleChipNav } from "@/components/layout/module-subnav";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

const POS_SETTINGS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.pos.settingsFiscalPayment,
    label: "Fiskal & Zahlung",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.settingsPrintersRouting,
    label: "Drucker & Routing",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.settingsKitchen,
    label: "Küche (KDS)",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.settingsInventoryVoid,
    label: "Bestand & Storno",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.settingsGiftVouchers,
    label: "Gutscheine",
    matchMode: "exact",
  },
];

export default function PosEinstellungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 px-4 pb-8 sm:px-6">
      <ModuleChipNav
        items={POS_SETTINGS_NAV}
        aria-label="POS-Einstellungen"
        className="pt-2"
      />
      {children}
    </div>
  );
}
