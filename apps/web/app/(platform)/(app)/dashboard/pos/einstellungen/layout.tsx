"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleSecondarySubnav } from "@/lib/contexts/app-module-chrome-context";
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
  {
    href: APP_ROUTES.pos.settingsDevicesRights,
    label: "Geräte & Rechte",
    matchMode: "exact",
  },
];

export default function PosEinstellungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RegisterModuleSecondarySubnav
        items={POS_SETTINGS_NAV}
        ariaLabel="POS-Einstellungen"
      />
      <div className="space-y-6 px-4 pb-8 sm:px-6">{children}</div>
    </>
  );
}
