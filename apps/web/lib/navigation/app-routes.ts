/** Restaurant-App unter `/dashboard/*` (nicht Superadmin, nicht öffentliches Profil). */

export const DASHBOARD_HOME = "/dashboard";

export const APP_ROUTES = {
  dashboard: DASHBOARD_HOME,
  menu: {
    root: "/dashboard/menu",
    overview: "/dashboard/menu/uebersicht",
    statistics: "/dashboard/menu/statistiken",
    export: "/dashboard/menu/export",
    embed: "/dashboard/menu/einbinden",
  },
  inventory: {
    root: "/dashboard/inventory",
    overview: "/dashboard/inventory/uebersicht",
    order: "/dashboard/inventory/bestellung",
    statistics: "/dashboard/inventory/statistiken",
  },
  reservierungen: {
    root: "/dashboard/reservierungen",
    overview: "/dashboard/reservierungen/uebersicht",
    floorPlan: "/dashboard/reservierungen/tischplan",
    stats: "/dashboard/reservierungen/statistiken",
    settings: "/dashboard/reservierungen/einstellungen",
    embed: "/dashboard/reservierungen/einbinden",
    protokoll: "/dashboard/reservierungen/protokoll",
  },
  kontakte: {
    root: "/dashboard/kontakte",
    messages: "/dashboard/kontakte/nachrichten",
    overview: "/dashboard/kontakte/uebersicht",
    statistics: "/dashboard/kontakte/statistiken",
    export: "/dashboard/kontakte/export",
    settings: "/dashboard/kontakte/einstellungen",
  },
  bewertungen: {
    root: "/dashboard/bewertungen",
    overview: "/dashboard/bewertungen/uebersicht",
    statistics: "/dashboard/bewertungen/statistiken",
    embed: "/dashboard/bewertungen/einbinden",
    settings: "/dashboard/bewertungen/einstellungen",
  },
  dokumente: {
    root: "/dashboard/dokumente",
    overview: "/dashboard/dokumente/uebersicht",
    statistics: "/dashboard/dokumente/statistiken",
    log: "/dashboard/dokumente/protokoll",
  },
  checklisten: {
    root: "/dashboard/checklisten",
    todos: "/dashboard/checklisten/todos",
    vorlagen: "/dashboard/checklisten/vorlagen",
    geraete: "/dashboard/checklisten/geraete",
    eintraege: "/dashboard/checklisten/eintraege",
    protokoll: "/dashboard/checklisten/protokoll",
    settings: "/dashboard/checklisten/einstellungen",
  },
  mitarbeiter: {
    root: "/dashboard/mitarbeiter",
    overview: "/dashboard/mitarbeiter/uebersicht",
    schedule: "/dashboard/mitarbeiter/schichtplan",
    contracts: "/dashboard/mitarbeiter/vertraege",
    documents: "/dashboard/mitarbeiter/dokumente",
    hours: "/dashboard/mitarbeiter/arbeitszeiten",
    statistics: "/dashboard/mitarbeiter/statistiken",
    export: "/dashboard/mitarbeiter/export",
    todos: "/dashboard/checklisten/todos",
  },
  buchfuehrung: {
    root: "/dashboard/buchfuehrung",
    invoices: "/dashboard/buchfuehrung/rechnungen",
    quotations: "/dashboard/buchfuehrung/angebote",
    vouchers: "/dashboard/buchfuehrung/belege",
    cashBook: "/dashboard/buchfuehrung/kasse",
    statistics: "/dashboard/buchfuehrung/statistiken",
    settings: "/dashboard/buchfuehrung/einstellungen",
  },
  galerie: {
    root: "/dashboard/galerie",
    overview: "/dashboard/galerie/uebersicht",
    statistics: "/dashboard/galerie/statistiken",
    embed: "/dashboard/galerie/einbinden",
    settings: "/dashboard/galerie/einstellungen",
  },
  events: {
    root: "/dashboard/events",
    overview: "/dashboard/events/uebersicht",
    embed: "/dashboard/events/einbinden",
    statistics: "/dashboard/events/statistiken",
    settings: "/dashboard/events/einstellungen",
  },
  settings: {
    root: "/dashboard/settings",
    restaurant: "/dashboard/settings/restaurant",
    dashboard: "/dashboard/settings/dashboard",
    team: "/dashboard/settings/team",
    openingHours: "/dashboard/settings/oeffnungszeiten",
    openingHoursEmbed: "/dashboard/settings/oeffnungszeiten/einbinden",
    integrations: "/dashboard/settings/integrationen",
    displays: "/dashboard/settings/displays",
    api: "/dashboard/settings/api",
  },
  profile: {
    root: "/dashboard/profile",
    personal: "/dashboard/profile/persoenliche-daten",
    login: "/dashboard/profile/anmeldung",
    notifications: "/dashboard/profile/benachrichtigungen",
    workHours: "/dashboard/profile/arbeitszeiten",
    schedule: "/dashboard/profile/dienstplan",
    availability: "/dashboard/profile/verfuegbarkeit",
    documents: "/dashboard/profile/dokumente",
    displayPin: "/dashboard/profile/display-pin",
  },
} as const;

/** Legacy-Pfade → neue Dashboard-Pfade (Permanent Redirect). */
export const LEGACY_MODULE_REDIRECTS: ReadonlyArray<{
  source: string;
  destination: string;
}> = [
  { source: "/dashboard/overview", destination: DASHBOARD_HOME },
  { source: "/dashboard/speisekarte", destination: APP_ROUTES.menu.overview },
  {
    source: "/dashboard/speisekarte/:path*",
    destination: "/dashboard/menu/:path*",
  },
  {
    source: "/dashboard/nachrichten",
    destination: APP_ROUTES.kontakte.messages,
  },
  {
    source: "/dashboard/nachrichten/:path*",
    destination: "/dashboard/kontakte/nachrichten/:path*",
  },
  { source: "/dashboard/bestand", destination: APP_ROUTES.inventory.overview },
  {
    source: "/dashboard/bestand/:path*",
    destination: "/dashboard/inventory/:path*",
  },
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
  {
    source: "/settings/eigenkontrolle",
    destination: "/dashboard/checklisten",
  },
  {
    source: "/settings/eigenkontrolle/:path*",
    destination: "/dashboard/checklisten/:path*",
  },
  { source: "/settings", destination: APP_ROUTES.settings.restaurant },
  { source: "/settings/:path*", destination: "/dashboard/settings/:path*" },
  { source: "/profile", destination: APP_ROUTES.profile.personal },
  { source: "/profile/:path*", destination: "/dashboard/profile/:path*" },
  {
    source: "/dashboard/mitarbeiter/todos",
    destination: "/dashboard/checklisten",
  },
  {
    source: "/dashboard/mitarbeiter/todos/:path*",
    destination: "/dashboard/checklisten",
  },
  {
    source: "/dashboard/inventory/export",
    destination: APP_ROUTES.inventory.overview,
  },
];
