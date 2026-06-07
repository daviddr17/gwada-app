/** Haupt-Scrollbereich unter Header/Chips in `AppShell` (nur Desktop-App mit Sidebar). */
export const APP_SCROLL_ROOT_SELECTOR = "[data-app-scroll-root]"

export function getAppScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const el = document.querySelector(APP_SCROLL_ROOT_SELECTOR)
  return el instanceof HTMLElement ? el : null
}
