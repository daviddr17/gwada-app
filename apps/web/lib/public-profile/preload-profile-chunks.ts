/** Embed-Widget-Chunks im Idle vorladen — Tab-Wechsel ohne Chunk-Pause. */
export function preloadProfileWidgetChunks() {
  void import("@/components/embed/embed-reservation-widget");
  void import("@/components/embed/embed-menu-widget");
  void import("@/components/embed/embed-reviews-widget");
  void import("@/components/embed/embed-news-widget");
  void import("@/components/public/restaurant-public-profile-news");
}

export function scheduleProfileBackgroundWork(work: () => void) {
  if (typeof window === "undefined") return () => {};

  const win = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (
        cb: IdleRequestCallback,
        opts?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

  if (win.requestIdleCallback) {
    const id = win.requestIdleCallback(work, { timeout: 2200 });
    return () => win.cancelIdleCallback?.(id);
  }

  const id = globalThis.setTimeout(work, 900);
  return () => globalThis.clearTimeout(id);
}
