/** Gemessene Inhaltshöhe für Embed-Resize-Nachrichten. */
export function measureEmbedContentHeight(
  measureTarget: HTMLElement,
  resizeMode: "content" | "viewport",
  viewportHeightPx?: number,
): number {
  if (resizeMode === "viewport") {
    return Math.ceil(viewportHeightPx ?? 640);
  }
  return Math.max(
    measureTarget.scrollHeight,
    measureTarget.getBoundingClientRect().height,
    document.documentElement.scrollHeight,
  );
}
