import type { Metadata } from "next";
import { formatDocumentTitle } from "@/lib/constants/document-title";

export const EMBED_PAGE_MODULE_LABELS = {
  news: "News",
  gallery: "Galerie",
  reservation: "Reservierung",
  menu: "Speisekarte",
  reviews: "Bewertungen",
  opening_hours: "Öffnungszeiten",
} as const;

export type EmbedPageModuleKey = keyof typeof EMBED_PAGE_MODULE_LABELS;

/** Browser-Tab für Embed-Direktlinks: `gwada - Restaurantname - Modul`. */
export function embedPageDocumentTitle(
  module: EmbedPageModuleKey,
  restaurantName?: string | null,
): string {
  const moduleLabel = EMBED_PAGE_MODULE_LABELS[module];
  const name = restaurantName?.trim();
  const pageTitle = name ? `${name} - ${moduleLabel}` : moduleLabel;
  return formatDocumentTitle(pageTitle);
}

export function embedPageMetadata(
  module: EmbedPageModuleKey,
  restaurantName?: string | null,
): Metadata {
  return {
    title: embedPageDocumentTitle(module, restaurantName),
    robots: { index: false, follow: false },
  };
}
