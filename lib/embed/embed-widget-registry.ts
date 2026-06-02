import type { GwadaEmbedWidgetId } from "@/lib/embed/embed-protocol";

export type GwadaEmbedWidgetDefinition = {
  id: GwadaEmbedWidgetId;
  /** iframe title (Barrierefreiheit). */
  title: string;
  /** Standard-Mindesthöhe bis erste Resize-Meldung. */
  defaultMinHeightPx: number;
  /** Pfad relativ zur App-Origin, ohne führenden Slash. */
  embedPath: (slug: string) => string;
  /** Geplant / noch nicht öffentlich einbettbar. */
  available: boolean;
};

function normalizedSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export const GWADA_EMBED_WIDGETS: Record<
  GwadaEmbedWidgetId,
  GwadaEmbedWidgetDefinition
> = {
  reservation: {
    id: "reservation",
    title: "Reservierung",
    defaultMinHeightPx: 420,
    embedPath: (slug) =>
      `embed/reservieren/${encodeURIComponent(normalizedSlug(slug))}`,
    available: true,
  },
  menu: {
    id: "menu",
    title: "Speisekarte",
    defaultMinHeightPx: 480,
    embedPath: (slug) =>
      `embed/speisekarte/${encodeURIComponent(normalizedSlug(slug))}`,
    available: true,
  },
  contact: {
    id: "contact",
    title: "Kontakt",
    defaultMinHeightPx: 360,
    embedPath: (slug) =>
      `embed/kontakt/${encodeURIComponent(normalizedSlug(slug))}`,
    available: false,
  },
};

export function parseGwadaEmbedWidgetId(
  raw: string | null | undefined,
): GwadaEmbedWidgetId | null {
  const id = raw?.trim().toLowerCase();
  if (id && id in GWADA_EMBED_WIDGETS) {
    return id as GwadaEmbedWidgetId;
  }
  return null;
}

export function embedWidgetAbsoluteUrl(
  widget: GwadaEmbedWidgetId,
  slug: string,
  origin: string,
  query?: Record<string, string>,
): string {
  const def = GWADA_EMBED_WIDGETS[widget];
  const base = origin.replace(/\/+$/, "");
  const path = def.embedPath(slug);
  const url = new URL(`${base}/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export const GWADA_EMBED_LOADER_PATH = "/embed/v1/gwada.js";

export function embedLoaderAbsoluteUrl(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${GWADA_EMBED_LOADER_PATH}`;
}
