/**
 * true, wenn das Widget per gwada.js auf einer fremden Website eingebettet ist
 * (Footer dann außerhalb des iframes — kein doppeltes Logo).
 */
export function isExternalHostEmbed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.self === window.top) return false;
  const params = new URLSearchParams(window.location.search);
  if (!params.get("gwada_embed_id")) return false;
  try {
    return window.parent.location.origin !== window.location.origin;
  } catch {
    return true;
  }
}
