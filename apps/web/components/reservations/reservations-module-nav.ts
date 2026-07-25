import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export const RESERVATIONS_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.reservierungen.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.reservierungen.root],
  },
  {
    href: APP_ROUTES.reservierungen.floorPlan,
    label: "Tischplan",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.reservierungen.stats,
    label: "Statistiken",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.reservierungen.protokoll,
    label: "Protokoll",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.reservierungen.settings,
    label: "Einstellungen",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.reservierungen.embed,
    label: "Einbinden",
    matchMode: "prefix",
  },
];
