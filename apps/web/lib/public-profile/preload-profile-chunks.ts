/** Embed-Widget-Chunks im Idle vorladen — Tab-Wechsel ohne Chunk-Pause. */
export function preloadProfileWidgetChunks() {
  void import("@/components/embed/embed-reservation-widget");
  void import("@/components/embed/embed-menu-widget");
  void import("@/components/embed/embed-reviews-widget");
  void import("@/components/embed/embed-news-widget");
  void import("@/components/embed/embed-events-widget");
  void import("@/components/embed/embed-event-inquiry-widget");
  void import("@/components/embed/embed-gallery-widget");
  void import("@/components/public/restaurant-public-profile-news");
  void import("@/components/public/restaurant-public-profile-events");
  void import("@/components/public/restaurant-public-profile-gallery");
  void import("@/components/public/restaurant-public-profile-reviews");
}

type NavigatorConnection = {
  saveData?: boolean;
  effectiveType?: string;
};

/** Save-Data / 2G — keine Hintergrund-Chunk-Preloads (LCP/Bandbreite). */
export function isProfilePreloadConstrained(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (
    navigator as Navigator & { connection?: NavigatorConnection }
  ).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  const t = conn.effectiveType;
  return t === "slow-2g" || t === "2g";
}

/**
 * Hintergrundarbeit nach First Paint.
 * Auf Save-Data/2G: kein Preload. Sonst requestIdleCallback (längeres Timeout bei Touch).
 */
export function scheduleProfileBackgroundWork(
  work: () => void,
  options?: { coarsePointer?: boolean },
) {
  if (typeof window === "undefined") return () => {};
  if (isProfilePreloadConstrained()) return () => {};

  const win = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (
        cb: IdleRequestCallback,
        opts?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

  const idleTimeout = options?.coarsePointer ? 6000 : 2200;
  const fallbackDelay = options?.coarsePointer ? 2500 : 900;

  if (win.requestIdleCallback) {
    const id = win.requestIdleCallback(work, { timeout: idleTimeout });
    return () => win.cancelIdleCallback?.(id);
  }

  const id = globalThis.setTimeout(work, fallbackDelay);
  return () => globalThis.clearTimeout(id);
}
