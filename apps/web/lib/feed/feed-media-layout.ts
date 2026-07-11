/** Fallback-Seitenverhältnis, wenn keine Metadaten (externe Quellen). */
export const FEED_MEDIA_FALLBACK_ASPECT = 4 / 5;

export const FEED_MEDIA_DEFAULT_WIDTH = 800;
export const FEED_MEDIA_DEFAULT_HEIGHT = 1000;

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

export function feedMasonryColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1280) return 4;
  if (viewportWidth >= 1024) return 3;
  if (viewportWidth >= 640) return 2;
  return 1;
}

export function feedGalleryColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 4;
  if (viewportWidth >= 640) return 3;
  return 2;
}

export function feedGridTemplateColumns(columnCount: number): string {
  return `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`;
}
