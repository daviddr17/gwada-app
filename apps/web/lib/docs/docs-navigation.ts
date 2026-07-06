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
