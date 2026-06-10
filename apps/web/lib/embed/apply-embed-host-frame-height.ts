import { EMBED_HOST_HEIGHT_TRANSITION } from "@/lib/embed/embed-resize-config";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  const immediate = options?.immediate ?? prev <= 0;
  if (immediate || prefersReducedMotion()) {
    frame.style.transition = "none";
  } else {
    frame.style.transition = EMBED_HOST_HEIGHT_TRANSITION;
  }

  frame.style.height = `${px}px`;
  frame.style.minHeight = "0";
  frame.dataset.gwadaHeight = String(px);
}
