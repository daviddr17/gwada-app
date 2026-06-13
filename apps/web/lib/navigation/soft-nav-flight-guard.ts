function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

let inFlight = false;
let pendingTarget: string | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/** Blockiert parallele Soft-Navs (beliebiges Ziel) — RSC-Race auf Live. */
export function beginSoftNavFlight(target: string): boolean {
  if (inFlight) return false;
  inFlight = true;
  pendingTarget = normalizePath(target);
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    inFlight = false;
    pendingTarget = null;
    releaseTimer = null;
  }, 5000);
  return true;
}

export function endSoftNavFlight(pathname: string): void {
  if (!inFlight || !pendingTarget) return;
  if (normalizePath(pathname) !== pendingTarget) return;
  inFlight = false;
  pendingTarget = null;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
}

export function isSoftNavFlightActive(): boolean {
  return inFlight;
}

/** Flight-Lock nach Queue-Task freigeben (auch wenn pathname noch nicht gesetzt). */
export function cancelSoftNavFlight(): void {
  inFlight = false;
  pendingTarget = null;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
}
