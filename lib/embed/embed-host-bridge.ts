import {
  GWADA_EMBED_MSG_FRAME_VIEWPORT,
  GWADA_EMBED_PROTOCOL_VERSION,
  isGwadaEmbedScrollToMessage,
  isGwadaEmbedToolbarPinMessage,
} from "@/lib/embed/embed-protocol";
import { getAppScrollRoot } from "@/lib/layout/app-scroll-root";

function hostScrollTarget(): HTMLElement | Window {
  return getAppScrollRoot() ?? window;
}

function measureEmbedPinTop(): number {
  if (typeof document === "undefined") return 0;
  let pin = 0;
  const header = document.querySelector("[data-app-chrome-header]");
  if (header instanceof HTMLElement) {
    pin = header.getBoundingClientRect().bottom;
  }
  const chips = document.querySelector("[data-module-chip-sticky]");
  if (chips instanceof HTMLElement) {
    pin = Math.max(pin, chips.getBoundingClientRect().bottom);
  }
  return pin;
}

/** Host-Seite / Vorschau: iframe-Viewport an Embed melden + Scroll-Anfragen bedienen. */
export function attachEmbedHostBridge(
  iframe: HTMLIFrameElement,
  targetOrigin: string,
): () => void {
  const embedId = iframe.id;
  if (!embedId) return () => {};

  let viewportRaf = 0;
  let toolbarPinned = false;
  let frozenPinTop: number | null = null;

  const resolveEmbedPinTop = () => {
    if (toolbarPinned && frozenPinTop != null) return frozenPinTop;
    const live = measureEmbedPinTop();
    frozenPinTop = live;
    return live;
  };

  const postViewport = () => {
    if (viewportRaf) return;
    viewportRaf = requestAnimationFrame(() => {
      viewportRaf = 0;
      const rect = iframe.getBoundingClientRect();
      const win = iframe.contentWindow;
      if (!win) return;
      win.postMessage(
        {
          type: GWADA_EMBED_MSG_FRAME_VIEWPORT,
          version: GWADA_EMBED_PROTOCOL_VERSION,
          embedId,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          bottom: rect.bottom,
          pinTop: resolveEmbedPinTop(),
        },
        targetOrigin,
      );
    });
  };

  const onScrollOrResize = (event: Event) => {
    if (!toolbarPinned || event.type === "resize") {
      frozenPinTop = measureEmbedPinTop();
    }
    postViewport();
  };

  const onMessage = (event: MessageEvent) => {
    if (targetOrigin !== "*" && event.origin !== targetOrigin) return;
    if (event.source !== iframe.contentWindow) return;

    if (isGwadaEmbedToolbarPinMessage(event.data)) {
      if (event.data.embedId !== embedId) return;
      toolbarPinned = event.data.pinned;
      if (toolbarPinned) {
        if (frozenPinTop == null) frozenPinTop = measureEmbedPinTop();
      } else {
        frozenPinTop = null;
      }
      postViewport();
      return;
    }

    if (!isGwadaEmbedScrollToMessage(event.data)) return;
    if (event.data.embedId !== embedId) return;

    const frameRect = iframe.getBoundingClientRect();
    const stickyH = event.data.stickyHeight;
    const pad = 8;
    const scrollEl = hostScrollTarget();

    if (scrollEl instanceof HTMLElement) {
      const rootRect = scrollEl.getBoundingClientRect();
      const delta =
        frameRect.top - rootRect.top + event.data.offsetTop - stickyH - pad;
      scrollEl.scrollTo({
        top: Math.max(0, scrollEl.scrollTop + delta),
        behavior: "smooth",
      });
      return;
    }

    const absoluteTarget =
      window.scrollY + frameRect.top + event.data.offsetTop - stickyH - pad;
    window.scrollTo({
      top: Math.max(0, absoluteTarget),
      behavior: "smooth",
    });
  };

  iframe.addEventListener("load", postViewport);
  const scrollEl = hostScrollTarget();
  scrollEl.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  window.addEventListener("message", onMessage);
  postViewport();

  return () => {
    iframe.removeEventListener("load", postViewport);
    scrollEl.removeEventListener("scroll", onScrollOrResize);
    window.removeEventListener("resize", onScrollOrResize);
    window.removeEventListener("message", onMessage);
    if (viewportRaf) cancelAnimationFrame(viewportRaf);
  };
}
