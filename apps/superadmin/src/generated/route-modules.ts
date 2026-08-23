"use client";

import { lazy, type ComponentType } from "react";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { wrapSuperadminPage } from "../routes/with-chrome";
import { SUPERADMIN_SYSTEM_NAV } from "@/lib/navigation/superadmin-system-routes";
import { SUPERADMIN_VORLAGEN_NAV } from "@/lib/navigation/superadmin-vorlagen-routes";

function chromeLazy(
  title: string,
  aria: string,
  nav: readonly ModuleSubnavItem[],
  importer: () => Promise<{ default: ComponentType }>,
) {
  return lazy(async () => {
    const mod = await importer();
    return { default: wrapSuperadminPage(title, aria, nav, mod.default) };
  });
}

const ALLGEMEIN_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/allgemein", label: "Allgemein", matchMode: "exact" },
];
const USER_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/users", label: "Übersicht", matchMode: "exact" },
  { href: "/superadmin/users/export", label: "Export", matchMode: "exact" },
  {
    href: "/superadmin/users/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
];
const RESTAURANTS_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/restaurants", label: "Übersicht", matchMode: "exact" },
  {
    href: "/superadmin/restaurants/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/superadmin/restaurants/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
];
const ABONNEMENTS_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/abonnements", label: "Übersicht", matchMode: "exact" },
  {
    href: "/superadmin/abonnements/zahlungen",
    label: "Zahlungen",
    matchMode: "exact",
  },
  {
    href: "/superadmin/abonnements/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
];
const WARTELISTE_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/warteliste", label: "Übersicht", matchMode: "exact" },
];
const NEWSLETTER_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/newsletter", label: "Übersicht", matchMode: "exact" },
  {
    href: "/superadmin/newsletter/vorlagen",
    label: "Vorlagen",
    matchMode: "exact",
  },
];
const INTEGRATIONEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/integrationen",
    label: "Übersicht",
    matchMode: "prefix",
  },
];
const WAHA_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/waha", label: "Server", matchMode: "exact" },
];
const DESIGN_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/design", label: "Referenz", matchMode: "exact" },
];
const CHANGELOG_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/changelog", label: "Übersicht", matchMode: "exact" },
];
const BENACHRICHTIGUNGEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/benachrichtigungen",
    label: "Log",
    matchMode: "exact",
  },
];

const LazyAllgemein = chromeLazy(
  "Allgemein",
  "Superadmin Allgemein",
  ALLGEMEIN_NAV,
  () => import("@/app/(platform)/(app)/superadmin/allgemein/page"),
);
const LazyUsers = chromeLazy("User", "User-Bereich", USER_NAV, () =>
  import("@/app/(platform)/(app)/superadmin/users/page"),
);
const LazyUsersExport = chromeLazy("User", "User-Bereich", USER_NAV, () =>
  import("@/app/(platform)/(app)/superadmin/users/export/page"),
);
const LazyUsersStats = chromeLazy("User", "User-Bereich", USER_NAV, () =>
  import("@/app/(platform)/(app)/superadmin/users/statistiken/page"),
);
const LazyRestaurants = chromeLazy(
  "Restaurants",
  "Restaurants-Bereich",
  RESTAURANTS_NAV,
  () => import("@/app/(platform)/(app)/superadmin/restaurants/page"),
);
const LazyRestaurantsExport = chromeLazy(
  "Restaurants",
  "Restaurants-Bereich",
  RESTAURANTS_NAV,
  () => import("@/app/(platform)/(app)/superadmin/restaurants/export/page"),
);
const LazyRestaurantsStats = chromeLazy(
  "Restaurants",
  "Restaurants-Bereich",
  RESTAURANTS_NAV,
  () => import("@/app/(platform)/(app)/superadmin/restaurants/statistiken/page"),
);
const LazyAbonnements = chromeLazy(
  "Abonnements",
  "Abonnements-Bereich",
  ABONNEMENTS_NAV,
  () => import("@/app/(platform)/(app)/superadmin/abonnements/page"),
);
const LazyAbonnementsZahlungen = chromeLazy(
  "Abonnements",
  "Abonnements-Bereich",
  ABONNEMENTS_NAV,
  () => import("@/app/(platform)/(app)/superadmin/abonnements/zahlungen/page"),
);
const LazyAbonnementsStats = chromeLazy(
  "Abonnements",
  "Abonnements-Bereich",
  ABONNEMENTS_NAV,
  () => import("@/app/(platform)/(app)/superadmin/abonnements/statistiken/page"),
);
const LazyWarteliste = chromeLazy(
  "Warteliste",
  "Superadmin Warteliste",
  WARTELISTE_NAV,
  () => import("@/app/(platform)/(app)/superadmin/warteliste/page"),
);
const LazyNewsletter = chromeLazy(
  "Newsletter",
  "Superadmin Newsletter",
  NEWSLETTER_NAV,
  () => import("@/app/(platform)/(app)/superadmin/newsletter/page"),
);
const LazyNewsletterTemplates = chromeLazy(
  "Newsletter",
  "Superadmin Newsletter",
  NEWSLETTER_NAV,
  () => import("@/app/(platform)/(app)/superadmin/newsletter/vorlagen/page"),
);
const LazyNewsletterEditor = lazy(
  () => import("../routes/newsletter-editor-route"),
);
const LazyIntegrationen = chromeLazy(
  "Integrationen",
  "Integrationen-Bereich",
  INTEGRATIONEN_NAV,
  () => import("@/app/(platform)/(app)/superadmin/integrationen/page"),
);
const LazyWaha = chromeLazy("WAHA", "Superadmin WAHA", WAHA_NAV, () =>
  import("@/app/(platform)/(app)/superadmin/waha/page"),
);
const LazyDatenbank = chromeLazy(
  "System",
  "Superadmin System",
  SUPERADMIN_SYSTEM_NAV,
  () => import("@/app/(platform)/(app)/superadmin/datenbank/page"),
);
const LazyLadeStrategie = chromeLazy(
  "System",
  "Superadmin System",
  SUPERADMIN_SYSTEM_NAV,
  () => import("@/app/(platform)/(app)/superadmin/lade-strategie/page"),
);
const LazyDesign = chromeLazy("Design", "Superadmin Design", DESIGN_NAV, () =>
  import("@/app/(platform)/(app)/superadmin/design/page"),
);
const LazyVertragsvorlagen = chromeLazy(
  "Vorlagen",
  "Superadmin Vorlagen",
  SUPERADMIN_VORLAGEN_NAV,
  () =>
    import("@/app/(platform)/(app)/superadmin/vorlagen/vertragsvorlagen/page"),
);
const LazyChangelog = chromeLazy(
  "Changelog",
  "Superadmin Changelog",
  CHANGELOG_NAV,
  () => import("@/app/(platform)/(app)/superadmin/changelog/page"),
);
const LazyBenachrichtigungen = chromeLazy(
  "Benachrichtigungen",
  "Superadmin Benachrichtigungen",
  BENACHRICHTIGUNGEN_NAV,
  () => import("@/app/(platform)/(app)/superadmin/benachrichtigungen/page"),
);

export type SuperadminRouteEntry = {
  path: string;
  fullPath: string;
  redirect?: string;
  Lazy?: ReturnType<typeof lazy>;
};

export const SUPERADMIN_ROUTE_ENTRIES: SuperadminRouteEntry[] = [
  { path: "/", fullPath: "/superadmin/allgemein", redirect: "/superadmin/allgemein" },
  { path: "/allgemein", fullPath: "/superadmin/allgemein", Lazy: LazyAllgemein },
  { path: "/users", fullPath: "/superadmin/users", Lazy: LazyUsers },
  {
    path: "/users/export",
    fullPath: "/superadmin/users/export",
    Lazy: LazyUsersExport,
  },
  {
    path: "/users/statistiken",
    fullPath: "/superadmin/users/statistiken",
    Lazy: LazyUsersStats,
  },
  {
    path: "/restaurants",
    fullPath: "/superadmin/restaurants",
    Lazy: LazyRestaurants,
  },
  {
    path: "/restaurants/export",
    fullPath: "/superadmin/restaurants/export",
    Lazy: LazyRestaurantsExport,
  },
  {
    path: "/restaurants/statistiken",
    fullPath: "/superadmin/restaurants/statistiken",
    Lazy: LazyRestaurantsStats,
  },
  {
    path: "/abonnements",
    fullPath: "/superadmin/abonnements",
    Lazy: LazyAbonnements,
  },
  {
    path: "/abonnements/zahlungen",
    fullPath: "/superadmin/abonnements/zahlungen",
    Lazy: LazyAbonnementsZahlungen,
  },
  {
    path: "/abonnements/statistiken",
    fullPath: "/superadmin/abonnements/statistiken",
    Lazy: LazyAbonnementsStats,
  },
  {
    path: "/warteliste",
    fullPath: "/superadmin/warteliste",
    Lazy: LazyWarteliste,
  },
  {
    path: "/newsletter",
    fullPath: "/superadmin/newsletter",
    Lazy: LazyNewsletter,
  },
  {
    path: "/newsletter/vorlagen",
    fullPath: "/superadmin/newsletter/vorlagen",
    Lazy: LazyNewsletterTemplates,
  },
  {
    path: "/newsletter/$id",
    fullPath: "/superadmin/newsletter/$id",
    Lazy: LazyNewsletterEditor,
  },
  {
    path: "/integrationen",
    fullPath: "/superadmin/integrationen",
    Lazy: LazyIntegrationen,
  },
  { path: "/waha", fullPath: "/superadmin/waha", Lazy: LazyWaha },
  {
    path: "/datenbank",
    fullPath: "/superadmin/datenbank",
    Lazy: LazyDatenbank,
  },
  {
    path: "/lade-strategie",
    fullPath: "/superadmin/lade-strategie",
    Lazy: LazyLadeStrategie,
  },
  { path: "/design", fullPath: "/superadmin/design", Lazy: LazyDesign },
  {
    path: "/vorlagen",
    fullPath: "/superadmin/vorlagen/vertragsvorlagen",
    redirect: "/superadmin/vorlagen/vertragsvorlagen",
  },
  {
    path: "/vorlagen/checklisten",
    fullPath: "/superadmin/vorlagen/vertragsvorlagen",
    redirect: "/superadmin/vorlagen/vertragsvorlagen",
  },
  {
    path: "/vorlagen/vertragsvorlagen",
    fullPath: "/superadmin/vorlagen/vertragsvorlagen",
    Lazy: LazyVertragsvorlagen,
  },
  {
    path: "/vertragsvorlagen",
    fullPath: "/superadmin/vorlagen/vertragsvorlagen",
    redirect: "/superadmin/vorlagen/vertragsvorlagen",
  },
  {
    path: "/changelog",
    fullPath: "/superadmin/changelog",
    Lazy: LazyChangelog,
  },
  {
    path: "/benachrichtigungen",
    fullPath: "/superadmin/benachrichtigungen",
    Lazy: LazyBenachrichtigungen,
  },
];
