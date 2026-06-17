function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

/** Bekannte Routen → lesbarer Abschnitt (pro Pfad-Präfix). */
const PATH_PAGE_TITLES: Record<string, string> = {
  "/": "Startseite",
  "/login": "Login",
  "/docs": "Docs",
  "/impressum": "Impressum",
  "/datenschutz": "Datenschutz",
  "/dashboard": "Dashboard",
  "/dashboard/menu": "Speisekarte",
  "/dashboard/menu/uebersicht": "Speisekarte",
  "/dashboard/menu/statistiken": "Statistiken",
  "/dashboard/menu/export": "Export",
  "/dashboard/menu/einbinden": "Einbinden",
  "/dashboard/bewertungen": "Bewertungen",
  "/dashboard/bewertungen/uebersicht": "Übersicht",
  "/dashboard/bewertungen/statistiken": "Statistiken",
  "/dashboard/bewertungen/einbinden": "Einbinden",
  "/dashboard/bewertungen/einstellungen": "Einstellungen",
  "/dashboard/news": "News",
  "/dashboard/news/uebersicht": "Übersicht",
  "/dashboard/news/statistiken": "Statistiken",
  "/dashboard/news/einbinden": "Einbinden",
  "/dashboard/news/einstellungen": "Einstellungen",
  "/dashboard/inventory": "Bestand",
  "/dashboard/inventory/uebersicht": "Bestand",
  "/dashboard/inventory/bestellung": "Bestellung",
  "/dashboard/inventory/statistiken": "Statistiken",
  "/dashboard/inventory/export": "Export",
  "/dashboard/kontakte": "Nachrichten",
  "/dashboard/kontakte/nachrichten": "Nachrichten",
  "/dashboard/kontakte/uebersicht": "Kontakte",
  "/dashboard/kontakte/statistiken": "Statistiken",
  "/dashboard/kontakte/export": "Export",
  "/dashboard/kontakte/einstellungen": "Einstellungen",
  "/dashboard/dokumente": "Dokumente",
  "/dashboard/dokumente/uebersicht": "Übersicht",
  "/dashboard/dokumente/statistiken": "Statistiken",
  "/dashboard/dokumente/protokoll": "Protokoll",
  "/dashboard/mitarbeiter": "Mitarbeiter",
  "/dashboard/mitarbeiter/uebersicht": "Übersicht",
  "/dashboard/mitarbeiter/schichtplan": "Schichtplan",
  "/dashboard/mitarbeiter/vertraege": "Verträge",
  "/dashboard/mitarbeiter/arbeitszeiten": "Arbeitszeiten",
  "/dashboard/mitarbeiter/statistiken": "Statistiken",
  "/dashboard/mitarbeiter/export": "Export",
  "/dashboard/buchfuehrung": "Buchführung",
  "/dashboard/buchfuehrung/rechnungen": "Rechnungen",
  "/dashboard/buchfuehrung/angebote": "Angebote",
  "/dashboard/buchfuehrung/belege": "Belege",
  "/dashboard/buchfuehrung/kasse": "Kasse",
  "/dashboard/buchfuehrung/statistiken": "Statistiken",
  "/dashboard/buchfuehrung/einstellungen": "Einstellungen",
  "/dashboard/galerie": "Galerie",
  "/dashboard/galerie/uebersicht": "Übersicht",
  "/dashboard/galerie/statistiken": "Statistiken",
  "/dashboard/galerie/einbinden": "Einbinden",
  "/dashboard/galerie/einstellungen": "Einstellungen",
  "/dashboard/reservierungen": "Reservierungen",
  "/dashboard/reservierungen/uebersicht": "Übersicht",
  "/dashboard/reservierungen/tischplan": "Tischplan",
  "/dashboard/reservierungen/statistiken": "Statistiken",
  "/dashboard/reservierungen/einstellungen": "Einstellungen",
  "/dashboard/reservierungen/einbinden": "Einbinden",
  "/dashboard/events": "Events",
  "/settings": "Einstellungen",
  "/settings/restaurant": "Übersicht",
  "/settings/team": "Team",
  "/settings/oeffnungszeiten": "Öffnungszeiten",
  "/settings/dashboard": "Dashboard",
  "/settings/integrationen": "Integrationen",
  "/settings/displays": "Displays",
  "/profile": "Profil",
  "/profile/persoenliche-daten": "Übersicht",
  "/profile/anmeldung": "Anmeldung",
  "/profile/arbeitszeiten": "Meine Arbeitszeiten",
  "/profile/dienstplan": "Dienstplan",
  "/workspace": "Workspace",
  "/workspace/restaurants": "Restaurants",
  "/workspace/team": "Team",
  "/changelog": "Changelog",
  "/superadmin": "Superadmin",
  "/superadmin/allgemein": "Allgemein",
  "/superadmin/users": "User",
  "/superadmin/users/export": "Export",
  "/superadmin/users/statistiken": "Statistiken",
  "/superadmin/restaurants": "Restaurants",
  "/superadmin/restaurants/export": "Export",
  "/superadmin/restaurants/statistiken": "Statistiken",
  "/superadmin/integrationen": "Integrationen",
  "/superadmin/datenbank": "Datenbank",
  "/superadmin/lade-strategie": "Lade-Strategie",
  "/superadmin/changelog": "Changelog",
  "/superadmin/benachrichtigungen": "Benachrichtigungen",
};

const SEGMENT_SLUG_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  allgemein: "Allgemein",
  reservierungen: "Reservierungen",
  einstellungen: "Einstellungen",
  uebersicht: "Übersicht",
  tischplan: "Tischplan",
  statistiken: "Statistiken",
  einbinden: "Einbinden",
  mitarbeiter: "Mitarbeiter",
  schichtplan: "Schichtplan",
  vertraege: "Verträge",
  arbeitszeiten: "Arbeitszeiten",
  dienstplan: "Dienstplan",
  dokumente: "Dokumente",
  protokoll: "Protokoll",
  kontakte: "Nachrichten",
  nachrichten: "Nachrichten",
  inventory: "Bestand",
  bestellung: "Bestellung",
  integrationen: "Integrationen",
  datenbank: "Datenbank",
  restaurants: "Restaurants",
  users: "User",
  dashboard: "Dashboard",
  settings: "Einstellungen",
  branding: "Branding",
  displays: "Displays",
  profile: "Profil",
  workspace: "Workspace",
  changelog: "Changelog",
  menu: "Speisekarte",
  export: "Export",
  login: "Login",
  impressum: "Impressum",
  datenschutz: "Datenschutz",
  docs: "Docs",
};

function humanizePathSegment(slug: string): string {
  const key = slug.toLowerCase();
  if (SEGMENT_SLUG_LABELS[key]) return SEGMENT_SLUG_LABELS[key];
  if (PATH_PAGE_TITLES[`/${key}`]) return PATH_PAGE_TITLES[`/${key}`]!;
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Tab-Inhalt aus URL-Pfad: jedes Segment nach `/` wird lesbar — z. B.
 * `/superadmin/allgemein` → `Superadmin - Allgemein` (stabil, unabhängig vom Modul-Chrome).
 */
export function resolveDocumentPageTitle(pathname: string): string {
  const path = normalizePath(pathname);
  if (path === "/") return "Startseite";

  const segments = path.split("/").filter(Boolean);
  const parts: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const prefix = `/${segments.slice(0, i + 1).join("/")}`;
    const label = PATH_PAGE_TITLES[prefix] ?? humanizePathSegment(segments[i]!);
    if (parts.length === 0 || parts[parts.length - 1] !== label) {
      parts.push(label);
    }
  }

  return parts.join(" - ");
}
