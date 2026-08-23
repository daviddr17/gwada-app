"use client";

import type { ComponentType, ReactNode } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { BUCHFUEHRUNG_MODULE_NAV } from "@/components/accounting/buchfuehrung-module-nav";
import { MESSAGES_MODULE_NAV } from "@/components/contacts/messages-module-nav";
import { DOCUMENTS_MODULE_NAV } from "@/components/documents/documents-module-nav";
import { EVENTS_MODULE_NAV } from "@/components/events/events-module-nav";
import { GALLERY_MODULE_NAV } from "@/components/gallery/gallery-module-nav";
import { INVENTORY_MODULE_NAV } from "@/components/inventory/inventory-module-nav";
import { MENU_MODULE_NAV } from "@/components/menu/menu-module-nav";
import { NEWS_MODULE_NAV } from "@/components/news/news-module-nav";
import { POS_MODULE_NAV } from "@/components/pos/pos-module-nav";
import { RESERVATIONS_MODULE_NAV } from "@/components/reservations/reservations-module-nav";
import { REVIEWS_MODULE_NAV } from "@/components/reviews/reviews-module-nav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { CHECKLISTEN_NAV } from "@/lib/navigation/checklisten-routes";

export type ModuleSubpageChromeConfig = {
  title: string;
  subnavAriaLabel: string;
  subnavItems: readonly ModuleSubnavItem[];
};

export const MODULE_SUBPAGE_CHROME = {
  menu: {
    title: "Speisekarte",
    subnavAriaLabel: "Speisekarten-Bereiche",
    subnavItems: MENU_MODULE_NAV,
  },
  inventory: {
    title: "Bestand",
    subnavAriaLabel: "Bestands-Bereiche",
    subnavItems: INVENTORY_MODULE_NAV,
  },
  reservierungen: {
    title: "Reservierungen",
    subnavAriaLabel: "Reservierungs-Bereiche",
    subnavItems: RESERVATIONS_MODULE_NAV,
  },
  pos: {
    title: "POS",
    subnavAriaLabel: "POS-Bereiche",
    subnavItems: POS_MODULE_NAV,
  },
  events: {
    title: "Events",
    subnavAriaLabel: "Events-Bereiche",
    subnavItems: EVENTS_MODULE_NAV,
  },
  kontakte: {
    title: "Nachrichten",
    subnavAriaLabel: "Nachrichten-Bereiche",
    subnavItems: MESSAGES_MODULE_NAV,
  },
  news: {
    title: "News",
    subnavAriaLabel: "News-Bereiche",
    subnavItems: NEWS_MODULE_NAV,
  },
  bewertungen: {
    title: "Bewertungen",
    subnavAriaLabel: "Bewertungs-Bereiche",
    subnavItems: REVIEWS_MODULE_NAV,
  },
  galerie: {
    title: "Galerie",
    subnavAriaLabel: "Galerie-Bereiche",
    subnavItems: GALLERY_MODULE_NAV,
  },
  buchfuehrung: {
    title: "Buchführung",
    subnavAriaLabel: "Buchführungs-Bereiche",
    subnavItems: BUCHFUEHRUNG_MODULE_NAV,
  },
  dokumente: {
    title: "Dokumente",
    subnavAriaLabel: "Dokumenten-Bereiche",
    subnavItems: DOCUMENTS_MODULE_NAV,
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
