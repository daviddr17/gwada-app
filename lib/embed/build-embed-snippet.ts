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
  /** @deprecated Rohes iframe. */
  legacyIframe: string;
  /** @deprecated iframe + Legacy-Resize-Script. */
  legacyCombined: string;
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

function buildLegacyIframe(src: string, title: string, minHeight: number): string {
  return `<iframe
  src="${src}"
  title="${title}"
  style="width:100%;border:0;display:block;min-height:${minHeight}px;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>`;
}

function buildLegacyResizeScript(): string {
  return `<script>
(function(){
  window.addEventListener("message",function(e){
    if(!e.data)return;
    var h=null,id=null;
    if(e.data.type==="gwada:embed:resize"&&typeof e.data.height==="number"){
      h=e.data.height; id=e.data.embedId;
    }else if(e.data.type==="gwada-embed-resize"&&typeof e.data.height==="number"){
      h=e.data.height; id=e.data.embedId;
    }
    if(!h||h<=0)return;
    var f=id
      ?document.getElementById(id)
      :document.querySelector('iframe[src*="/embed/"]');
    if(f&&f.tagName==="IFRAME"){
      f.style.height=Math.ceil(h)+"px";
      f.style.minHeight="0";
    }
  });
})();
</script>`;
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
  const legacyIframe = buildLegacyIframe(
    embedUrl,
    def.title,
    params.minHeightPx ?? def.defaultMinHeightPx,
  );

  return {
    recommended,
    placeholder,
    loaderUrl,
    embedUrl,
    legacyIframe,
    legacyCombined: `${legacyIframe}\n${buildLegacyResizeScript()}`,
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
