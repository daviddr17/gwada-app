import { isStandalonePwaClient } from "@/lib/pwa/is-standalone-pwa-client";

/** `html[data-display-mode]` für mobile Safe-Area / Bottom-Chrome (PWA vs Browser). */
export function syncDisplayModeAttribute(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(
    "data-display-mode",
    isStandalonePwaClient() ? "standalone" : "browser",
  );
}

export function installDisplayModeAttributeSync(): () => void {
  syncDisplayModeAttribute();
  const mq = window.matchMedia("(display-mode: standalone)");
  const onChange = () => syncDisplayModeAttribute();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
