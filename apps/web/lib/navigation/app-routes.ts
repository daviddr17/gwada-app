/** Restaurant-App unter `/dashboard/*` (nicht Superadmin, nicht öffentliches Profil). */

export const DASHBOARD_HOME = "/dashboard";

export const APP_ROUTES = {
  dashboard: DASHBOARD_HOME,
  menu: {
    root: "/dashboard/menu",
    overview: "/dashboard/menu/uebersicht",
    export: "/dashboard/menu/export",
    embed: "/dashboard/menu/einbinden",
  },
  inventory: {
    root: "/dashboard/inventory",
    overview: "/dashboard/inventory/uebersicht",
    order: "/dashboard/inventory/bestellung",
    export: "/dashboard/inventory/export",
  },
  reservierungen: {
    root: "/dashboard/reservierungen",
    overview: "/dashboard/reservierungen/uebersicht",
    floorPlan: "/dashboard/reservierungen/tischplan",
    stats: "/dashboard/reservierungen/statistiken",
    settings: "/dashboard/reservierungen/einstellungen",
    embed: "/dashboard/reservierungen/einbinden",
  },
  kontakte: {
    root: "/dashboard/kontakte",
    messages: "/dashboard/kontakte/nachrichten",
    overview: "/dashboard/kontakte/uebersicht",
    export: "/dashboard/kontakte/export",
    settings: "/dashboard/kontakte/einstellungen",
  },
  bewertungen: {
    root: "/dashboard/bewertungen",
    overview: "/dashboard/bewertungen/uebersicht",
    embed: "/dashboard/bewertungen/einbinden",
    settings: "/dashboard/bewertungen/einstellungen",
  },
  dokumente: {
    root: "/dashboard/dokumente",
    overview: "/dashboard/dokumente/uebersicht",
    log: "/dashboard/dokumente/protokoll",
  },
  mitarbeiter: {
    root: "/dashboard/mitarbeiter",
    overview: "/dashboard/mitarbeiter/uebersicht",
    schedule: "/dashboard/mitarbeiter/schichtplan",
    contracts: "/dashboard/mitarbeiter/vertraege",
    hours: "/dashboard/mitarbeiter/arbeitszeiten",
    export: "/dashboard/mitarbeiter/export",
  },
  buchfuehrung: {
    root: "/dashboard/buchfuehrung",
    invoices: "/dashboard/buchfuehrung/rechnungen",
    quotations: "/dashboard/buchfuehrung/angebote",
    vouchers: "/dashboard/buchfuehrung/belege",
    cashBook: "/dashboard/buchfuehrung/kasse",
    settings: "/dashboard/buchfuehrung/einstellungen",
  },
} as const;

/** Legacy-Pfade → neue Dashboard-Pfade (Permanent Redirect). */
export const LEGACY_MODULE_REDIRECTS: ReadonlyArray<{
  source: string;
  destination: string;
}> = [
  { source: "/menu", destination: APP_ROUTES.menu.overview },
  { source: "/menu/:path*", destination: "/dashboard/menu/:path*" },
  { source: "/inventory", destination: APP_ROUTES.inventory.overview },
  { source: "/inventory/:path*", destination: "/dashboard/inventory/:path*" },
  { source: "/reservierungen", destination: APP_ROUTES.reservierungen.overview },
  {
    source: "/reservierungen/:path*",
    destination: "/dashboard/reservierungen/:path*",
  },
  {
    source: "/kontakte",
    destination: `${APP_ROUTES.kontakte.messages}?platform=all`,
  },
  { source: "/kontakte/:path*", destination: "/dashboard/kontakte/:path*" },
  { source: "/bewertungen", destination: APP_ROUTES.bewertungen.overview },
  { source: "/bewertungen/:path*", destination: "/dashboard/bewertungen/:path*" },
  { source: "/dokumente", destination: APP_ROUTES.dokumente.overview },
  { source: "/dokumente/:path*", destination: "/dashboard/dokumente/:path*" },
  { source: "/mitarbeiter", destination: APP_ROUTES.mitarbeiter.overview },
  { source: "/mitarbeiter/:path*", destination: "/dashboard/mitarbeiter/:path*" },
  {
    source: "/buchfuehrung",
    destination: APP_ROUTES.buchfuehrung.invoices,
  },
  {
    source: "/buchfuehrung/:path*",
    destination: "/dashboard/buchfuehrung/:path*",
  },
];
