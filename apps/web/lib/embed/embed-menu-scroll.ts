import {
  GWADA_EMBED_MSG_SCROLL_TO,
  GWADA_EMBED_MSG_TOOLBAR_PIN,
  GWADA_EMBED_PROTOCOL_VERSION,
  isGwadaEmbedFrameViewportMessage,
  type GwadaEmbedFrameViewportMessage,
} from "@/lib/embed/embed-protocol";

/** Scroll-Container im Profil-Modul-Sheet (iOS-App-Overlay). */
export const PROFILE_APP_SCROLL_ROOT_SELECTOR = "[data-profile-app-scroll-root]";

export function findProfileScrollRootContaining(
  el: HTMLElement | null,
): HTMLElement | null {
  if (!el) return null;
  const root = el.closest(PROFILE_APP_SCROLL_ROOT_SELECTOR);
  return root instanceof HTMLElement ? root : null;
}

export function readGwadaEmbedId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("gwada_embed_id");
}

export function isGwadaEmbedHostMode(): boolean {
  if (typeof window === "undefined") return false;
  if (readGwadaEmbedId()) return true;
  return window.self !== window.top;
}

/** OffsetTop relativ zum iframe-Dokument (nicht Layout-Viewport). */
export function offsetTopInEmbedDocument(el: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

export function postEmbedScrollToHost(
  embedId: string,
  categoryId: string,
  stickyHeight: number,
): boolean {
  const el = document.getElementById(`menu-cat-${categoryId}`);
  if (!el) return false;

  window.parent.postMessage(
    {
      type: GWADA_EMBED_MSG_SCROLL_TO,
      version: GWADA_EMBED_PROTOCOL_VERSION,
      embedId,
      offsetTop: offsetTopInEmbedDocument(el),
      stickyHeight,
    },
    "*",
  );
  return true;
}

export function postEmbedToolbarPinState(
  embedId: string,
  pinned: boolean,
): void {
  window.parent.postMessage(
    {
      type: GWADA_EMBED_MSG_TOOLBAR_PIN,
      version: GWADA_EMBED_PROTOCOL_VERSION,
      embedId,
      pinned,
    },
    "*",
  );
}

export function subscribeEmbedHostViewport(
  embedId: string,
  onViewport: (viewport: GwadaEmbedFrameViewportMessage) => void,
): () => void {
  const onMessage = (event: MessageEvent) => {
    if (!isGwadaEmbedFrameViewportMessage(event.data)) return;
    if (event.data.embedId !== embedId) return;
    onViewport(event.data);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

export function scrollToMenuCategoryInPage(
  categoryId: string,
  stickyHeight: number,
): void {
  const el = document.getElementById(`menu-cat-${categoryId}`);
  if (!el) return;
  const pad = 8;
  const rect = el.getBoundingClientRect();
  window.scrollTo({
    top: window.scrollY + rect.top - stickyHeight - pad,
    behavior: "smooth",
  });
}

export function scrollToMenuCategoryInContainer(
  scrollRoot: HTMLElement,
  categoryId: string,
  stickyHeight: number,
): void {
  const el = document.getElementById(`menu-cat-${categoryId}`);
  if (!el) return;
  const pad = 8;
  const elRect = el.getBoundingClientRect();
  const rootRect = scrollRoot.getBoundingClientRect();
  const delta = elRect.top - rootRect.top - stickyHeight - pad;
  scrollRoot.scrollTo({
    top: Math.max(0, scrollRoot.scrollTop + delta),
    behavior: "smooth",
  });
}

/** Profil-Sheet: sichtbarer sticky Chrome (Handle + Name/Modul) + Menü-Toolbar. */
export function profileSheetMenuStickyScrollOffset(
  scrollRoot: HTMLElement,
  toolbarHeight: number,
): number {
  const rootRect = scrollRoot.getBoundingClientRect();
  let pinnedBottom = rootRect.top;

  const sheet =
    scrollRoot.closest("[data-profile-app-sheet]") ?? scrollRoot.parentElement;
  const handle = sheet?.querySelector("[data-profile-app-sheet-handle]");
  if (handle instanceof HTMLElement) {
    pinnedBottom = Math.max(
      pinnedBottom,
      handle.getBoundingClientRect().bottom,
    );
  }

  for (const selector of ["[data-profile-app-sheet-header]"]) {
    const el = scrollRoot.querySelector(selector);
    if (el instanceof HTMLElement) {
      pinnedBottom = Math.max(
        pinnedBottom,
        el.getBoundingClientRect().bottom,
      );
    }
  }

  return Math.max(0, pinnedBottom - rootRect.top) + toolbarHeight;
}
