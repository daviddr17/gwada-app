import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export const MESSAGES_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.kontakte.messages,
    label: "Nachrichten",
    matchMode: "prefix",
    activeWhen: [APP_ROUTES.kontakte.root],
  },
  {
    href: APP_ROUTES.kontakte.overview,
    label: "Kontakte",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.kontakte.statistics,
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.kontakte.export,
    label: "Export",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.kontakte.settings,
    label: "Einstellungen",
    matchMode: "prefix",
  },
];
