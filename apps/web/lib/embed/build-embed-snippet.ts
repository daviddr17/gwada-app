import { getPublicSiteUrl } from "@/lib/public-env";
import type { GwadaEmbedWidgetId } from "@/lib/embed/embed-protocol";
import {
  embedLoaderAbsoluteUrl,
  embedWidgetAbsoluteUrl,
  GWADA_EMBED_WIDGETS,
  type GwadaEmbedWidgetDefinition,
} from "@/lib/embed/embed-widget-registry";

export type GwadaEmbedSnippet = {
  /** Empfohlen: Platzhalter + Loader (X-Style). */
  recommended: string;
  /** Nur Platzhalter (wenn gwada.js schon global geladen). */
  placeholder: string;
  /** Loader-URL für manuelles Nachladen. */
  loaderUrl: string;
  /** Direktlink zum Embed (iframe-Ziel). */
  embedUrl: string;
};

function resolveOrigin(origin?: string): string {
  const base = (origin ?? getPublicSiteUrl() ?? "").replace(/\/+$/, "");
  if (!base && typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }
  return base;
}

function buildPlaceholderHtml(
  def: GwadaEmbedWidgetDefinition,
  slug: string,
  minHeightPx?: number,
): string {
  const minH = minHeightPx ?? def.defaultMinHeightPx;
  return `<div
  data-gwada-widget="${def.id}"
  data-gwada-slug="${slug.trim().toLowerCase()}"
  style="min-height:${minH}px;"
></div>`;
}

function buildScriptTag(loaderUrl: string): string {
  return `<script async src="${loaderUrl}"></script>`;
}

export function buildGwadaEmbedSnippet(params: {
  widget: GwadaEmbedWidgetId;
  slug: string;
  origin?: string;
  minHeightPx?: number;
}): GwadaEmbedSnippet {
  const def = GWADA_EMBED_WIDGETS[params.widget];
  const slug = params.slug.trim().toLowerCase();
  const origin = resolveOrigin(params.origin);
  const loaderUrl = embedLoaderAbsoluteUrl(origin);
  const embedUrl = embedWidgetAbsoluteUrl(params.widget, slug, origin);
  const placeholder = buildPlaceholderHtml(def, slug, params.minHeightPx);
  const script = buildScriptTag(loaderUrl);
  const recommended = `${placeholder}\n${script}`;
  return {
    recommended,
    placeholder,
    loaderUrl,
    embedUrl,
  };
}

/** Reservierungswidget — Convenience für bestehende Aufrufer. */
export function buildReservationEmbedSnippet(
  slug: string,
  origin?: string,
): GwadaEmbedSnippet {
  return buildGwadaEmbedSnippet({ widget: "reservation", slug, origin });
}

/** Speisekarten-Widget — Convenience für Menü-Einbindung. */
export function buildMenuEmbedSnippet(
  slug: string,
  origin?: string,
): GwadaEmbedSnippet {
  return buildGwadaEmbedSnippet({ widget: "menu", slug, origin });
}

/** Bewertungs-Widget — Gwada-Gästebewertungen auf der Restaurant-Website. */
export function buildReviewsEmbedSnippet(
  slug: string,
  origin?: string,
): GwadaEmbedSnippet {
  return buildGwadaEmbedSnippet({ widget: "reviews", slug, origin });
}

/** News-Widget — aggregierter Multi-Plattform-Feed auf der Restaurant-Website. */
export function buildNewsEmbedSnippet(
  slug: string,
  origin?: string,
): GwadaEmbedSnippet {
  return buildGwadaEmbedSnippet({ widget: "news", slug, origin });
}

/** Öffnungszeiten-Widget — reguläre Zeiten, optional Küche + Sondertermine. */
export function buildOpeningHoursEmbedSnippet(
  slug: string,
  origin?: string,
): GwadaEmbedSnippet {
  return buildGwadaEmbedSnippet({ widget: "opening_hours", slug, origin });
}
