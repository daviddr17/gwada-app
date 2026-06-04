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
  "/menu": "Speisekarte",
  "/menu/uebersicht": "Speisekarte",
  "/menu/export": "Export",
  "/menu/einbinden": "Einbinden",
  "/bewertungen": "Bewertungen",
  "/bewertungen/uebersicht": "Übersicht",
  "/bewertungen/einbinden": "Einbinden",
  "/inventory": "Bestand",
  "/inventory/uebersicht": "Bestand",
  "/inventory/bestellung": "Bestellung",
  "/inventory/export": "Export",
  "/kontakte": "Nachrichten",
  "/kontakte/nachrichten": "Nachrichten",
  "/kontakte/uebersicht": "Kontakte",
  "/kontakte/export": "Export",
  "/kontakte/einstellungen": "Einstellungen",
  "/dokumente": "Dokumente",
  "/dokumente/uebersicht": "Übersicht",
  "/dokumente/protokoll": "Protokoll",
  "/mitarbeiter": "Mitarbeiter",
  "/mitarbeiter/uebersicht": "Übersicht",
  "/mitarbeiter/vertraege": "Verträge",
  "/mitarbeiter/arbeitszeiten": "Arbeitszeiten",
  "/mitarbeiter/export": "Export",
  "/reservierungen": "Reservierungen",
  "/reservierungen/uebersicht": "Übersicht",
  "/reservierungen/tischplan": "Tischplan",
  "/reservierungen/statistiken": "Statistiken",
  "/reservierungen/einstellungen": "Einstellungen",
  "/reservierungen/einbinden": "Einbinden",
  "/settings": "Einstellungen",
  "/settings/restaurant": "Übersicht",
  "/settings/team": "Team",
  "/settings/oeffnungszeiten": "Öffnungszeiten",
  "/settings/dashboard": "Dashboard",
  "/settings/rollen": "Rollen",
  "/settings/integrationen": "Integrationen",
  "/settings/branding": "Branding",
  "/settings/displays": "Displays",
  "/profile": "Profil",
  "/profile/persoenliche-daten": "Übersicht",
  "/profile/anmeldung": "Anmeldung",
  "/profile/arbeitszeiten": "Arbeitszeiten",
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
  "/superadmin/changelog": "Changelog",
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
  vertraege: "Verträge",
  arbeitszeiten: "Arbeitszeiten",
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
