import type { GwadaEmbedFrameViewportMessage } from "@/lib/embed/embed-protocol";
import { offsetTopInEmbedDocument } from "@/lib/embed/embed-menu-scroll";

export type EmbedMenuToolbarPinState = {
  pinned: boolean;
  fixedTopPx: number;
  /** Scroll-Spy-Linie (Browser-Koordinaten). */
  spyLine: number;
  /** Beim Pin eingefrorene pinTop-Linie (verhindert Sprünge durch Header-Remessung). */
  frozenPinTop: number;
};

const PIN_ON_PX = 2;
const PIN_OFF_PX = 24;

export function normalizeHostViewport(
  vp: GwadaEmbedFrameViewportMessage,
): GwadaEmbedFrameViewportMessage {
  return vp;
}

/** Sticky per Host-Viewport: Dokument-Offset + Host-Rect (Safari-safe), mit Hysterese. */
export function computeEmbedMenuToolbarPin(
  hostViewport: GwadaEmbedFrameViewportMessage,
  sentinelEl: HTMLElement,
  toolbarHeight: number,
  wasPinned: boolean,
  frozenPinTop: number | null,
): EmbedMenuToolbarPinState {
  const livePinTop = hostViewport.pinTop ?? 0;
  const pinTop =
    wasPinned && frozenPinTop != null ? frozenPinTop : livePinTop;
  const sentinelDocTop = offsetTopInEmbedDocument(sentinelEl);
  const sentinelScreenTop = hostViewport.top + sentinelDocTop;
  const iframeVisible = hostViewport.bottom > pinTop + Math.max(toolbarHeight, 48);

  const shouldPin = sentinelScreenTop <= pinTop + PIN_ON_PX;
  const shouldUnpin = sentinelScreenTop > pinTop + PIN_OFF_PX;
  const pinned = wasPinned
    ? iframeVisible && !shouldUnpin
    : iframeVisible && shouldPin;

  const nextFrozenPinTop = pinned
    ? wasPinned && frozenPinTop != null
      ? frozenPinTop
      : livePinTop
    : livePinTop;

  const fixedTopPx = pinned ? pinTop - hostViewport.top : 0;
  const spyLine = pinned
    ? pinTop + toolbarHeight + 4
    : sentinelScreenTop + toolbarHeight + 4;

  return {
    pinned,
    fixedTopPx,
    spyLine,
    frozenPinTop: nextFrozenPinTop,
  };
}

export function activeCategoryForSpyLine(
  categories: { id: string }[],
  spyLine: number,
  sectionScreenTop: (id: string) => number,
): string | undefined {
  let current = categories[0]?.id;
  for (const c of categories) {
    if (sectionScreenTop(c.id) <= spyLine) current = c.id;
  }
  return current;
}

let lastAppliedTopPx = Number.NaN;

export function applyEmbedMenuToolbarPinStyles(
  outerEl: HTMLElement | null,
  innerEl: HTMLElement | null,
  pin: Pick<EmbedMenuToolbarPinState, "pinned" | "fixedTopPx">,
): void {
  if (!outerEl) return;

  if (pin.pinned) {
    const y = Math.round(pin.fixedTopPx);
    if (y === lastAppliedTopPx) return;
    lastAppliedTopPx = y;

    outerEl.style.position = "fixed";
    outerEl.style.top = `${y}px`;
    outerEl.style.left = "0";
    outerEl.style.right = "0";
    outerEl.style.width = "100%";
    outerEl.style.zIndex = "20";
    outerEl.style.transform = "";
    outerEl.style.willChange = "top";
    outerEl.classList.add("embed-menu-toolbar-pinned-outer");
    innerEl?.classList.add("embed-menu-toolbar-pinned-inner");
  } else {
    if (Number.isNaN(lastAppliedTopPx) && !outerEl.style.position) return;
    lastAppliedTopPx = Number.NaN;

    outerEl.classList.remove("embed-menu-toolbar-pinned-outer");
    outerEl.style.position = "";
    outerEl.style.top = "";
    outerEl.style.left = "";
    outerEl.style.right = "";
    outerEl.style.width = "";
    outerEl.style.zIndex = "";
    outerEl.style.transform = "";
    outerEl.style.willChange = "";
    innerEl?.classList.remove("embed-menu-toolbar-pinned-inner");
  }
}

export function resetEmbedMenuToolbarPinStyles(
  outerEl: HTMLElement | null,
  innerEl: HTMLElement | null,
): void {
  lastAppliedTopPx = Number.NaN;
  applyEmbedMenuToolbarPinStyles(outerEl, innerEl, {
    pinned: false,
    fixedTopPx: 0,
  });
}
