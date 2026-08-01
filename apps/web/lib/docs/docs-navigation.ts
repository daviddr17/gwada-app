export type DocsNavItem = {
  title: string;
  href: string;
  items?: DocsNavItem[];
};

export const DOCS_NAV: DocsNavItem[] = [
  {
    title: "Übersicht",
    href: "/docs",
  },
  {
    title: "Erste Schritte",
    href: "/docs/erste-schritte",
    items: [
      { title: "Willkommen", href: "/docs/erste-schritte" },
      { title: "Navigation", href: "/docs/navigation" },
    ],
  },
  {
    title: "Handbuch",
    href: "/docs/handbuch/dashboard",
    items: [
      { title: "Dashboard", href: "/docs/handbuch/dashboard" },
      { title: "Speisekarte", href: "/docs/handbuch/speisekarte" },
      { title: "Bestand", href: "/docs/handbuch/bestand" },
      { title: "Reservierungen", href: "/docs/handbuch/reservierungen" },
      { title: "Events", href: "/docs/handbuch/events" },
      { title: "Nachrichten", href: "/docs/handbuch/nachrichten" },
      { title: "News", href: "/docs/handbuch/news" },
      { title: "Bewertungen", href: "/docs/handbuch/bewertungen" },
      { title: "Insights", href: "/docs/handbuch/insights" },
      { title: "Galerie", href: "/docs/handbuch/galerie" },
      { title: "Buchführung", href: "/docs/handbuch/buchfuehrung" },
      { title: "Dokumente", href: "/docs/handbuch/dokumente" },
      { title: "Checklisten", href: "/docs/handbuch/checklisten" },
      { title: "Mitarbeiter", href: "/docs/handbuch/mitarbeiter" },
      { title: "Einstellungen", href: "/docs/handbuch/einstellungen" },
      { title: "Integrationen", href: "/docs/handbuch/integrationen" },
      { title: "Display", href: "/docs/handbuch/display" },
      { title: "Öffentliches Profil", href: "/docs/handbuch/oeffentliches-profil" },
      { title: "Profil", href: "/docs/handbuch/profil" },
    ],
  },
  {
    title: "API",
    href: "/docs/api",
    items: [
      { title: "Einstieg", href: "/docs/api" },
      { title: "Authentifizierung", href: "/docs/api/authentication" },
      { title: "Rate Limits", href: "/docs/api/rate-limits" },
      { title: "Speisekarte", href: "/docs/api/menu" },
      { title: "Reservierung", href: "/docs/api/reservation" },
      { title: "Bewertungen", href: "/docs/api/reviews" },
      { title: "News", href: "/docs/api/news" },
      { title: "Events", href: "/docs/api/events" },
      { title: "Galerie", href: "/docs/api/gallery" },
      { title: "Öffnungszeiten", href: "/docs/api/opening-hours" },
    ],
  },
];

export function isDocsNavItemActive(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  if (href.startsWith("/docs/handbuch/") && pathname.startsWith("/docs/handbuch/")) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isDocsNavSectionActive(
  pathname: string,
  section: DocsNavItem,
): boolean {
  if (isDocsNavItemActive(pathname, section.href)) return true;
  if (section.items?.some((item) => pathname === item.href)) return true;
  if (
    section.href.startsWith("/docs/handbuch/") &&
    pathname.startsWith("/docs/handbuch/")
  ) {
    return true;
  }
  if (section.href === "/docs/api" && pathname.startsWith("/docs/api")) {
    return true;
  }
  if (
    section.href === "/docs/erste-schritte" &&
    (pathname === "/docs/erste-schritte" || pathname === "/docs/navigation")
  ) {
    return true;
  }
  return false;
}

/** Href der Sektion, die den aktuellen Pfad enthält — für Accordion-Default. */
export function docsNavActiveSectionHref(pathname: string): string | null {
  for (const section of DOCS_NAV) {
    if (isDocsNavSectionActive(pathname, section)) return section.href;
  }
  return null;
}

/** Kurztitel der aktuellen Docs-Seite (für Mobile-Trigger). */
export function docsNavCurrentTitle(pathname: string): string {
  for (const section of DOCS_NAV) {
    if (section.items) {
      const item = section.items.find((entry) => pathname === entry.href);
      if (item) return item.title;
    }
    if (isDocsNavItemActive(pathname, section.href) && !section.items) {
      return section.title;
    }
  }
  if (pathname.startsWith("/docs/handbuch/")) return "Handbuch";
  if (pathname.startsWith("/docs/api")) return "API";
  return "Dokumentation";
}
