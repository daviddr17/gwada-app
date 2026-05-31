import type { AppModuleChromeState } from "@/lib/contexts/app-module-chrome-context";
import { isActiveModulePath } from "@/components/layout/module-subnav";

function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

/** Bekannte Routen → Tab-Titel (wenn kein Modul-Chip aktiv ist). */
const PATH_PAGE_TITLES: Record<string, string> = {
  "/": "Startseite",
  "/login": "Anmelden",
  "/dashboard": "Dashboard",
  "/menu": "Speisekarte",
  "/menu/uebersicht": "Speisekarte",
  "/menu/export": "Export",
  "/inventory": "Bestand",
  "/inventory/bestellung": "Bestellung",
  "/inventory/export": "Export",
  "/kontakte": "Kontakte",
  "/kontakte/uebersicht": "Kontakte",
  "/kontakte/nachrichten": "Nachrichten",
  "/kontakte/export": "Export",
  "/dokumente": "Dokumente",
  "/dokumente/uebersicht": "Übersicht",
  "/dokumente/protokoll": "Protokoll",
  "/mitarbeiter": "Mitarbeiter",
  "/mitarbeiter/uebersicht": "Übersicht",
  "/mitarbeiter/vertraege": "Verträge",
  "/mitarbeiter/arbeitszeiten": "Arbeitszeiten",
  "/reservierungen": "Reservierungen",
  "/reservierungen/uebersicht": "Übersicht",
  "/reservierungen/tischplan": "Tischplan",
  "/reservierungen/einstellungen": "Einstellungen",
  "/settings": "Einstellungen",
  "/settings/restaurant": "Übersicht",
  "/settings/team": "Team",
  "/settings/oeffnungszeiten": "Öffnungszeiten",
  "/settings/dashboard": "Dashboard",
  "/settings/rollen": "Rollen",
  "/settings/integrationen": "Integrationen",
  "/settings/branding": "Branding",
  "/profile": "Profil",
  "/profile/persoenliche-daten": "Übersicht",
  "/profile/anmeldung": "Anmeldung",
  "/workspace/restaurants": "Übersicht",
  "/workspace/team": "Team",
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
};

function pathnamePageTitle(pathname: string): string {
  const path = normalizePath(pathname);
  if (PATH_PAGE_TITLES[path]) return PATH_PAGE_TITLES[path];
  const entries = Object.entries(PATH_PAGE_TITLES).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [prefix, title] of entries) {
    if (path.startsWith(`${prefix}/`) || path === prefix) {
      return title;
    }
  }
  return "App";
}

/** Aktuelle Seite für den Tab-Titel (Subnav-Chip > Modul-Titel > Route). */
export function resolveDocumentPageTitle(
  pathname: string,
  chrome: AppModuleChromeState,
): string {
  const subnav = chrome.subnav;
  if (subnav?.items.length) {
    const active = subnav.items.find((item) =>
      isActiveModulePath(pathname, item),
    );
    if (active?.label.trim()) {
      return active.label.trim();
    }
  }
  if (chrome.title.trim()) {
    return chrome.title.trim();
  }
  return pathnamePageTitle(pathname);
}
