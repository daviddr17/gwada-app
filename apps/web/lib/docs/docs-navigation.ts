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

export function docsNavFlat(): DocsNavItem[] {
  const out: DocsNavItem[] = [];
  for (const section of DOCS_NAV) {
    out.push(section);
    if (section.items) out.push(...section.items);
  }
  return out;
}
