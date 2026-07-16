/** Haupt-Scrollbereich unter Header/Chips in `AppShell`. */
export const APP_SCROLL_ROOT_SELECTOR = "[data-app-scroll-root]";

export function getAppScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(APP_SCROLL_ROOT_SELECTOR);
  return el instanceof HTMLElement ? el : null;
}

/**
 * Refcount für Overlay-Scroll-Locks.
 * Verhindert „hängenbleibendes“ `overflow: hidden` nach Soft-Nav / gestapelten Overlays.
 */
let lockCount = 0;
let savedRootOverflow: string | null = null;
let savedRootScrollTop = 0;
let savedBodyOverflow: string | null = null;
let savedBodyOverscroll: string | null = null;
let savedHtmlOverflow: string | null = null;

function applyLockStyles() {
  const root = getAppScrollRoot();
  if (root) {
    savedRootOverflow = root.style.overflow;
    savedRootScrollTop = root.scrollTop;
    root.style.overflow = "hidden";
  }
  savedBodyOverflow = document.body.style.overflow;
  savedBodyOverscroll = document.body.style.overscrollBehavior;
  savedHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.body.style.overscrollBehavior = "none";
}

function clearLockStyles(restoreScrollTop: boolean) {
  const root = getAppScrollRoot();
  if (root) {
    root.style.overflow = savedRootOverflow ?? "";
    if (restoreScrollTop) {
      root.scrollTop = savedRootScrollTop;
    }
  }
  document.body.style.overflow = savedBodyOverflow ?? "";
  document.body.style.overscrollBehavior = savedBodyOverscroll ?? "";
  document.documentElement.style.overflow = savedHtmlOverflow ?? "";
  savedRootOverflow = null;
  savedBodyOverflow = null;
  savedBodyOverscroll = null;
  savedHtmlOverflow = null;
}

/**
 * Sperrt App-Scroll-Root (+ Body-Fallback). Rückgabe = Unlock (idempotent).
 * Mehrere Overlays: erst der letzte Unlock gibt den Scroll wieder frei.
 */
export function acquireAppScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    applyLockStyles();
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (typeof document === "undefined") return;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      clearLockStyles(true);
    }
  };
}

/**
 * Failsafe nach Modulwechsel: alle Locks und typische Overlay-Reste entfernen.
 * Scroll-Position der Seite bewusst nicht zurücksetzen (Soft-Nav).
 */
export function forceResetAppScrollLocks(): void {
  if (typeof document === "undefined") return;

  lockCount = 0;
  const root = getAppScrollRoot();
  if (root) {
    root.style.removeProperty("overflow");
  }
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("overscroll-behavior");
  document.body.style.removeProperty("position");
  document.body.style.removeProperty("top");
  document.body.style.removeProperty("left");
  document.body.style.removeProperty("right");
  document.body.style.removeProperty("width");
  document.body.style.removeProperty("margin-right");
  document.documentElement.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("padding-right");
  document.documentElement.removeAttribute("data-base-ui-scroll-locked");
  document.body.removeAttribute("data-base-ui-scroll-locked");
  document.documentElement.removeAttribute("data-scroll-locked");
  document.body.removeAttribute("data-scroll-locked");

  savedRootOverflow = null;
  savedBodyOverflow = null;
  savedBodyOverscroll = null;
  savedHtmlOverflow = null;
}

export function getAppScrollLockCountForTests(): number {
  return lockCount;
}
