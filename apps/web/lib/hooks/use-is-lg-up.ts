"use client";

import { useSyncExternalStore } from "react";

/** Tailwind `lg` — Desktop Master-Detail (Nachrichten-Split). */
const LG_MQ = "(min-width: 1024px)";

function subscribeLg(onChange: () => void): () => void {
  const mq = window.matchMedia(LG_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getLgSnapshot(): boolean {
  return window.matchMedia(LG_MQ).matches;
}

function getLgServerSnapshot(): boolean {
  return false;
}

/** `true` ab Tailwind `lg` (1024px). SSR / vor Hydration: `false`. */
export function useIsLgUp(): boolean {
  return useSyncExternalStore(subscribeLg, getLgSnapshot, getLgServerSnapshot);
}
