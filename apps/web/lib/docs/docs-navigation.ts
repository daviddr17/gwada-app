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
    href: "/docs/getting-started",
    items: [
      { title: "Willkommen", href: "/docs/getting-started" },
      { title: "Navigation", href: "/docs/navigation" },
    ],
  },
  {
    title: "Handbuch",
    href: "/docs/handbook/dashboard",
    items: [
      { title: "Dashboard", href: "/docs/handbook/dashboard" },
      { title: "Speisekarte", href: "/docs/handbook/menu" },
      { title: "Bestand", href: "/docs/handbook/inventory" },
      { title: "Reservierungen", href: "/docs/handbook/reservations" },
      { title: "Events", href: "/docs/handbook/events" },
      { title: "Nachrichten", href: "/docs/handbook/messages" },
      { title: "News", href: "/docs/handbook/news" },
      { title: "Bewertungen", href: "/docs/handbook/reviews" },
      { title: "Insights", href: "/docs/handbook/insights" },
      { title: "Galerie", href: "/docs/handbook/gallery" },
      { title: "Buchführung", href: "/docs/handbook/accounting" },
      { title: "Dokumente", href: "/docs/handbook/documents" },
      { title: "Aufgaben", href: "/docs/handbook/tasks" },
      { title: "Mitarbeiter", href: "/docs/handbook/staff" },
      { title: "Einstellungen", href: "/docs/handbook/settings" },
      { title: "Integrationen", href: "/docs/handbook/integrations" },
      { title: "Display", href: "/docs/handbook/display" },
      { title: "Öffentliches Profil", href: "/docs/handbook/public-profile" },
      { title: "Profil", href: "/docs/handbook/profile" },
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
      { title: "Bestellungen", href: "/docs/api/purchase-orders" },
    ],
  },
];

export function isDocsNavItemActive(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  if (href.startsWith("/docs/handbook/") && pathname.startsWith("/docs/handbook/")) {
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
    section.href.startsWith("/docs/handbook/") &&
    pathname.startsWith("/docs/handbook/")
  ) {
    return true;
  }
  if (section.href === "/docs/api" && pathname.startsWith("/docs/api")) {
    return true;
  }
  if (
    section.href === "/docs/getting-started" &&
    (pathname === "/docs/getting-started" || pathname === "/docs/navigation")
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
  if (pathname.startsWith("/docs/handbook/")) return "Handbuch";
  if (pathname.startsWith("/docs/api")) return "API";
  return "Dokumentation";
}
