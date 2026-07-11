/** Gemessene Inhaltshöhe für Embed-Resize-Nachrichten. */
export function measureEmbedContentHeight(
  measureTarget: HTMLElement,
  resizeMode: "content" | "viewport",
  viewportHeightPx?: number,
): number {
  if (resizeMode === "viewport") {
    return Math.ceil(viewportHeightPx ?? 640);
  }

  const rootRect = measureTarget.getBoundingClientRect();
  const measureEnd = measureTarget.querySelector<HTMLElement>(
    "[data-gwada-embed-measure-end]",
  );
  if (measureEnd) {
    const endRect = measureEnd.getBoundingClientRect();
    const markerHeight = Math.ceil(endRect.bottom - rootRect.top);
    if (markerHeight > 0) return markerHeight;
  }

  const contentRoot =
    measureTarget.querySelector<HTMLElement>("[data-gwada-embed-content]") ??
    measureTarget;

  let maxBottom = rootRect.top;
  for (const el of contentRoot.querySelectorAll<HTMLElement>(
    "[data-gwada-embed-measure-end], [data-gwada-embed-content] > *",
  )) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) continue;
    maxBottom = Math.max(maxBottom, rect.bottom);
  }

  const walkedHeight = Math.ceil(maxBottom - rootRect.top);
  if (walkedHeight > 0) return walkedHeight;

  const layoutHeight = Math.max(
    measureTarget.getBoundingClientRect().height,
    measureTarget.offsetHeight,
  );
  const scrollHeight = measureTarget.scrollHeight;

  // CSS-Columns: scrollHeight kann Einspalt-Stapelhöhe melden — nicht für iframe nutzen.
  const plausibleScrollHeight =
    scrollHeight <= layoutHeight * 1.15 + 24 ? scrollHeight : layoutHeight;

  return Math.ceil(Math.max(layoutHeight, plausibleScrollHeight));
}
