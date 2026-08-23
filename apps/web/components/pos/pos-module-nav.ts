"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** POS-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const POS_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.pos.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.pos.root],
  },
  { href: APP_ROUTES.pos.orders, label: "Bestellungen", matchMode: "exact" },
  { href: APP_ROUTES.pos.receipts, label: "Quittungen", matchMode: "exact" },
  { href: APP_ROUTES.pos.giftVouchers, label: "Gutscheine", matchMode: "exact" },
  { href: APP_ROUTES.pos.statistics, label: "Statistiken", matchMode: "exact" },
  { href: APP_ROUTES.pos.reports, label: "Berichte", matchMode: "exact" },
  { href: APP_ROUTES.pos.settings, label: "Einstellungen", matchMode: "prefix" },
];
