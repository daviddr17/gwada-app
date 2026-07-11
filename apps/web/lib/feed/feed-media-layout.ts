/** Fallback-Seitenverhältnis, wenn keine Metadaten (externe Quellen). */
export const FEED_MEDIA_FALLBACK_ASPECT = 4 / 5;

export const FEED_MEDIA_DEFAULT_WIDTH = 800;
export const FEED_MEDIA_DEFAULT_HEIGHT = 1000;

/** News-Feed: Portrait 4:5 … Landscape 1.91:1 (Instagram-ähnlich). */
export const FEED_NEWS_MIN_ASPECT = 4 / 5;
export const FEED_NEWS_MAX_ASPECT = 1.91;

export function feedMediaDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): { width: number; height: number; aspectRatio: number } {
  const w =
    typeof width === "number" && width > 0 ? width : FEED_MEDIA_DEFAULT_WIDTH;
  const h =
    typeof height === "number" && height > 0
      ? height
      : FEED_MEDIA_DEFAULT_HEIGHT;
  return { width: w, height: h, aspectRatio: w / h };
}

/** News-Karten: Seitenverhältnis in sinnvolle Feed-Grenzen clampen. */
export function feedNewsDisplayAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): number {
  const { aspectRatio } = feedMediaDimensions(width, height);
  return Math.min(
    FEED_NEWS_MAX_ASPECT,
    Math.max(FEED_NEWS_MIN_ASPECT, aspectRatio),
  );
}

/** News-Raster — mobil 1 Spalte, Desktop bis 3 (weniger parallele Bild-Loads). */
export const feedNewsGridClassName =
  "grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

/** Galerie — CSS-Columns-Masonry (Pinterest), mobil 1 Spalte. */
export const feedGalleryMasonryClassName =
  "columns-1 gap-1 sm:columns-2 lg:columns-3 xl:columns-4";

export const feedGalleryMasonryItemClassName =
  "mb-1 w-full break-inside-avoid";

/** @deprecated Nur noch für Skeleton-Fallback — Layout per Tailwind-Klassen. */
export function feedMasonryColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1280) return 3;
  if (viewportWidth >= 768) return 2;
  return 1;
}

/** @deprecated Nur noch für Skeleton-Fallback — Layout per Tailwind-Klassen. */
export function feedGalleryColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1280) return 4;
  if (viewportWidth >= 1024) return 3;
  if (viewportWidth >= 640) return 2;
  return 1;
}

/** @deprecated Layout per `feedNewsGridClassName`. */
export function feedGridTemplateColumns(columnCount: number): string {
  return `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`;
}
