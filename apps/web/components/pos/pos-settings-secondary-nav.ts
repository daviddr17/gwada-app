import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Secondary chips under POS → Einstellungen. */
export const POS_SETTINGS_SECONDARY_NAV: readonly ModuleSubnavItem[] = [
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
    href: APP_ROUTES.pos.settingsOnlineOrdering,
    label: "Online & Kiosk",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.settingsDevicesRights,
    label: "Geräte & Rechte",
    matchMode: "exact",
  },
];
