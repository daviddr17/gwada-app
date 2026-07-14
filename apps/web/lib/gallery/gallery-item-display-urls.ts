import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";

/** Scharfe Anzeige-URL + optionales Thumb für Blur-up. */
export function galleryItemDisplayUrls(item: UnifiedGalleryItem): {
  src: string;
  thumbSrc: string | null;
} {
  const preview = item.previewUrl.trim();
  const full = item.fullUrl?.trim() || null;
  const thumb = item.thumbUrl?.trim() || null;

  const src = full && full.length > 0 ? full : preview;

  if (thumb && thumb !== src) {
    return { src, thumbSrc: thumb };
  }

  // Externe Quellen: preview oft CDN-Thumb, full die scharfe Version.
  if (full && full !== preview) {
    return { src: full, thumbSrc: preview };
  }

  return { src, thumbSrc: null };
}
