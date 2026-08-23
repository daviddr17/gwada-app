"use client";

import type { ComponentType, ReactNode } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { MESSAGES_MODULE_NAV } from "@/components/contacts/messages-module-nav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import {
  CHECKLISTEN_NAV,
} from "@/lib/navigation/checklisten-routes";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export type ModuleSubpageChromeConfig = {
  title: string;
  subnavAriaLabel: string;
  subnavItems: readonly ModuleSubnavItem[];
};

const MENU_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/menu/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/menu"],
  },
  { href: "/dashboard/menu/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/menu/export", label: "Export", matchMode: "exact" },
  { href: "/dashboard/menu/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/menu/einstellungen", label: "Einstellungen", matchMode: "exact" },
];

const INVENTORY_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/inventory/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/inventory"],
  },
  { href: "/dashboard/inventory/bestellung", label: "Bestellung", matchMode: "exact" },
  { href: "/dashboard/inventory/statistiken", label: "Statistiken", matchMode: "exact" },
];

const RESERVIERUNGEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.reservierungen.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.reservierungen.root],
  },
  { href: APP_ROUTES.reservierungen.floorPlan, label: "Tischplan", matchMode: "exact" },
  { href: APP_ROUTES.reservierungen.protokoll, label: "Protokoll", matchMode: "exact" },
  { href: APP_ROUTES.reservierungen.stats, label: "Statistiken", matchMode: "exact" },
  { href: APP_ROUTES.reservierungen.embed, label: "Einbinden", matchMode: "prefix" },
  { href: APP_ROUTES.reservierungen.settings, label: "Einstellungen", matchMode: "exact" },
];

const POS_NAV: readonly ModuleSubnavItem[] = [
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

const EVENTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/events/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/events"],
  },
  { href: "/dashboard/events/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/events/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/events/einstellungen", label: "Einstellungen", matchMode: "exact" },
];

const NEWS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/news/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/news"],
  },
  { href: "/dashboard/news/autopilot", label: "Autopilot", matchMode: "exact" },
  { href: "/dashboard/news/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/news/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/news/einstellungen", label: "Einstellungen", matchMode: "exact" },
];

const BEWERTUNGEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/bewertungen/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/bewertungen"],
  },
  { href: "/dashboard/bewertungen/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/bewertungen/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/bewertungen/einstellungen", label: "Einstellungen", matchMode: "exact" },
];

const GALERIE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/galerie/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/galerie"],
  },
  { href: "/dashboard/galerie/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/galerie/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/galerie/einstellungen", label: "Einstellungen", matchMode: "exact" },
];

const BUCH_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/buchfuehrung/rechnungen",
    label: "Rechnungen",
    matchMode: "exact",
    activeWhen: ["/dashboard/buchfuehrung"],
  },
  { href: "/dashboard/buchfuehrung/angebote", label: "Angebote", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/belege", label: "Belege", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/kasse", label: "Kasse", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/einstellungen", label: "Einstellungen", matchMode: "exact" },
];

const DOKUMENTE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/dokumente/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/dokumente"],
  },
  { href: "/dashboard/dokumente/protokoll", label: "Protokoll", matchMode: "exact" },
  { href: "/dashboard/dokumente/statistiken", label: "Statistiken", matchMode: "exact" },
];

export const MODULE_SUBPAGE_CHROME = {
  menu: {
    title: "Speisekarte",
    subnavAriaLabel: "Speisekarten-Bereiche",
    subnavItems: MENU_NAV,
  },
  inventory: {
    title: "Bestand",
    subnavAriaLabel: "Bestands-Bereiche",
    subnavItems: INVENTORY_NAV,
  },
  reservierungen: {
    title: "Reservierungen",
    subnavAriaLabel: "Reservierungs-Bereiche",
    subnavItems: RESERVIERUNGEN_NAV,
  },
  pos: {
    title: "POS",
    subnavAriaLabel: "POS-Bereiche",
    subnavItems: POS_NAV,
  },
  events: {
    title: "Events",
    subnavAriaLabel: "Events-Bereiche",
    subnavItems: EVENTS_NAV,
  },
  kontakte: {
    title: "Nachrichten",
    subnavAriaLabel: "Nachrichten-Bereiche",
    subnavItems: MESSAGES_MODULE_NAV,
  },
  news: {
    title: "News",
    subnavAriaLabel: "News-Bereiche",
    subnavItems: NEWS_NAV,
  },
  bewertungen: {
    title: "Bewertungen",
    subnavAriaLabel: "Bewertungs-Bereiche",
    subnavItems: BEWERTUNGEN_NAV,
  },
  galerie: {
    title: "Galerie",
    subnavAriaLabel: "Galerie-Bereiche",
    subnavItems: GALERIE_NAV,
  },
  buchfuehrung: {
    title: "Buchführung",
    subnavAriaLabel: "Buchführungs-Bereiche",
    subnavItems: BUCH_NAV,
  },
  dokumente: {
    title: "Dokumente",
    subnavAriaLabel: "Dokumenten-Bereiche",
    subnavItems: DOKUMENTE_NAV,
  },
  checklisten: {
    title: "Checklisten",
    subnavAriaLabel: "Checklisten-Bereiche",
    subnavItems: CHECKLISTEN_NAV,
  },
} as const satisfies Record<string, ModuleSubpageChromeConfig>;

export type ModuleSubpageKey = keyof typeof MODULE_SUBPAGE_CHROME;

export function ModuleSubpageChrome({
  moduleKey,
  children,
}: {
  moduleKey: ModuleSubpageKey;
  children: ReactNode;
}) {
  const cfg = MODULE_SUBPAGE_CHROME[moduleKey];
  return (
    <>
      <RegisterModuleChrome
        title={cfg.title}
        subnavAriaLabel={cfg.subnavAriaLabel}
        subnavItems={cfg.subnavItems}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}

export function wrapModuleSubpage(
  moduleKey: ModuleSubpageKey,
  Page: ComponentType,
): ComponentType {
  function Wrapped() {
    return (
      <ModuleSubpageChrome moduleKey={moduleKey}>
        <Page />
      </ModuleSubpageChrome>
    );
  }
  Wrapped.displayName = `ModuleSubpage(${moduleKey})`;
  return Wrapped;
}

export function moduleSubpageLazy(
  moduleKey: ModuleSubpageKey,
  importer: () => Promise<{ default: ComponentType }>,
) {
  return async () => {
    const mod = await importer();
    return { default: wrapModuleSubpage(moduleKey, mod.default) };
  };
}
