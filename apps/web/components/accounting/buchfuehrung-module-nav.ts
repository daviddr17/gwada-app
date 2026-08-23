"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Buchführung-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const BUCHFUEHRUNG_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/buchfuehrung/rechnungen",
    label: "Rechnungen",
    matchMode: "exact",
    activeWhen: ["/dashboard/buchfuehrung"],
  },
  { href: "/dashboard/buchfuehrung/angebote", label: "Angebote", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/belege", label: "Belege", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/kasse", label: "Kasse", matchMode: "exact" },
  {
    href: "/dashboard/buchfuehrung/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/buchfuehrung/einstellungen",
    label: "Einstellungen",
    matchMode: "exact",
  },
];
