"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Buchführung-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const BUCHFUEHRUNG_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/accounting/invoices",
    label: "Rechnungen",
    matchMode: "exact",
    activeWhen: ["/dashboard/accounting"],
  },
  { href: "/dashboard/accounting/quotations", label: "Angebote", matchMode: "exact" },
  { href: "/dashboard/accounting/vouchers", label: "Belege", matchMode: "exact" },
  { href: "/dashboard/accounting/cash-book", label: "Kasse", matchMode: "exact" },
  {
    href: "/dashboard/accounting/statistics",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/accounting/settings",
    label: "Einstellungen",
    matchMode: "exact",
  },
];
