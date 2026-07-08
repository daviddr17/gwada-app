/** Hintergrund-Arbeit nach Paint / in Idle-Zeit — UI-Klicks zuerst. */
export function runWhenIdle(task: () => void, timeoutMs = 4000): void {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => task(), { timeout: timeoutMs });
    return;
  }
  setTimeout(task, Math.min(timeoutMs, 1500));
}
