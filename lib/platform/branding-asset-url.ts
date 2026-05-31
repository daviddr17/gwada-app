/** Cache-Buster für Logo/Favicon (Browser cachen Tabs-Icons sehr aggressiv). */
export function brandingAssetCacheKey(
  storagePath: string | null | undefined,
): string | null {
  const path = storagePath?.trim();
  return path || null;
}

export function withBrandingAssetCacheBust(
  publicUrl: string | null | undefined,
  storagePath: string | null | undefined,
): string | null {
  const url = publicUrl?.trim();
  if (!url) return null;
  const key = brandingAssetCacheKey(storagePath);
  if (!key) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(key)}`;
}

export function faviconMimeTypeFromPath(
  storagePath: string | null | undefined,
): string | undefined {
  const p = storagePath?.trim().toLowerCase() ?? "";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".ico")) return "image/x-icon";
  return undefined;
}

/** ICO wird im Browser-Tab unterstützt, in <img> aber oft nicht — nur PNG/WebP/SVG/JPEG. */
export function isFaviconRenderableInImg(
  storagePath: string | null | undefined,
): boolean {
  const p = storagePath?.trim().toLowerCase() ?? "";
  if (!p) return false;
  return (
    p.endsWith(".png") ||
    p.endsWith(".jpg") ||
    p.endsWith(".jpeg") ||
    p.endsWith(".webp") ||
    p.endsWith(".svg")
  );
}
