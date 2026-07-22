import {
  EMBED_HEIGHT_IGNORE_DELTA_PX,
  EMBED_HOST_HEIGHT_TRANSITION,
} from "@/lib/embed/embed-resize-config";

const FEED_WIDGETS = new Set(["news", "events", "gallery", "reviews"]);

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isFeedHostFrame(frame: HTMLIFrameElement): boolean {
  const key = (frame.getAttribute("data-gwada-widget") || "").toLowerCase();
  return FEED_WIDGETS.has(key);
}

/** Host-Seite / Vorschau: iframe-Höhe mit optionaler Transition (wie gwada.js). */
export function applyEmbedHostFrameHeight(
  frame: HTMLIFrameElement,
  height: number,
  options?: { immediate?: boolean },
): void {
  const px = Math.ceil(height);
  if (px <= 0) return;

  const prev = frame.dataset.gwadaHeight
    ? Number.parseInt(frame.dataset.gwadaHeight, 10)
    : 0;
  if (prev === px) return;
  if (prev > 0 && Math.abs(px - prev) < EMBED_HEIGHT_IGNORE_DELTA_PX) return;

  const feed = isFeedHostFrame(frame);
  const smallDelta = prev > 0 && Math.abs(px - prev) <= 24;
  const immediate = options?.immediate ?? prev <= 0;
  // Feed: nie animieren — sonst reflowt die Host-Seite unter dem Embed.
  if (feed || immediate || smallDelta || prefersReducedMotion()) {
    frame.style.transition = "none";
  } else {
    frame.style.transition = EMBED_HOST_HEIGHT_TRANSITION;
  }

  frame.style.height = `${px}px`;
  frame.style.minHeight = "0";
  frame.dataset.gwadaHeight = String(px);
}
