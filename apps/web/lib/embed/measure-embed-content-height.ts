/** Gemessene Inhaltshöhe für Embed-Resize-Nachrichten. */
export function measureEmbedContentHeight(
  measureTarget: HTMLElement,
  resizeMode: "content" | "viewport",
  viewportHeightPx?: number,
): number {
  if (resizeMode === "viewport") {
    return Math.ceil(viewportHeightPx ?? 640);
  }
  const layoutHeight = Math.max(
    measureTarget.getBoundingClientRect().height,
    measureTarget.offsetHeight,
  );
  const scrollHeight = measureTarget.scrollHeight;

  // CSS multi-column (Pinterest/Masonry) kann scrollHeight als Einspaltiger-Stapel melden.
  const plausibleScrollHeight =
    scrollHeight <= layoutHeight * 1.15 + 24 ? scrollHeight : layoutHeight;

  return Math.ceil(Math.max(layoutHeight, plausibleScrollHeight));
}
