/** @deprecated Import from `@/lib/embed/build-embed-snippet`. */
export {
  buildGwadaEmbedSnippet,
  buildReservationEmbedSnippet,
  type GwadaEmbedSnippet,
} from "@/lib/embed/build-embed-snippet";

import { getPublicSiteUrl } from "@/lib/public-env";
import { embedWidgetAbsoluteUrl } from "@/lib/embed/embed-widget-registry";

export function embedReservierenPath(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return `/embed/reservieren/${encodeURIComponent(normalized)}`;
}

export function embedReservierenAbsoluteUrl(
  slug: string,
  origin?: string,
): string {
  const base = (origin ?? getPublicSiteUrl() ?? "").replace(/\/+$/, "");
  if (!base) return embedReservierenPath(slug);
  return embedWidgetAbsoluteUrl("reservation", slug, base);
}
