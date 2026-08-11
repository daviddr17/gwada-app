"use client";

import { matchModuleHomeId, type ModuleHomeId } from "@/lib/navigation/module-home-keep-alive";

/** Sidebar Intent → Keep-alive-Slot sofort mounten (vor Soft-Nav-Click). */
export const GWADA_MODULE_HOME_WARM_INTENT_EVENT =
  "gwada:module-home-warm-intent";

export function requestModuleHomeWarm(id: ModuleHomeId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_MODULE_HOME_WARM_INTENT_EVENT, {
      detail: { id },
    }),
  );
}

export function requestModuleHomeWarmForHref(href: string): void {
  const id = matchModuleHomeId(href);
  if (!id || id === "dashboard") return;
  requestModuleHomeWarm(id);
}

export function onModuleHomeWarmIntent(
  callback: (id: ModuleHomeId) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const id = (event as CustomEvent<{ id?: ModuleHomeId }>).detail?.id;
    if (!id) return;
    callback(id);
  };
  window.addEventListener(GWADA_MODULE_HOME_WARM_INTENT_EVENT, handler);
  return () => {
    window.removeEventListener(GWADA_MODULE_HOME_WARM_INTENT_EVENT, handler);
  };
}
