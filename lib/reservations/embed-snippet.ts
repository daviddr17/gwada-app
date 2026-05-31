import { getPublicSiteUrl } from "@/lib/public-env";

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
  return `${base}${embedReservierenPath(slug)}`;
}

/** Kurzer iframe-Embed (Twitter/X-Stil) + optionales Höhen-Script. */
export function buildReservationEmbedSnippet(
  slug: string,
  origin?: string,
): { iframe: string; script: string; combined: string } {
  const src = embedReservierenAbsoluteUrl(slug, origin);
  const iframe = `<iframe
  src="${src}"
  title="Reservierung"
  style="width:100%;border:0;display:block;min-height:420px;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>`;

  const script = `<script>
(function(){
  window.addEventListener("message",function(e){
    if(!e.data||e.data.type!=="gwada-embed-resize")return;
    var f=document.querySelector('iframe[src*="/embed/reservieren/"]');
    if(f&&typeof e.data.height==="number"&&e.data.height>0){
      f.style.height=Math.ceil(e.data.height)+"px";
      f.style.minHeight="0";
    }
  });
})();
</script>`;

  return { iframe, script, combined: `${iframe}\n${script}` };
}
