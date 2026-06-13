function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

let activeTarget: string | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/** Verhindert parallele Soft-Navs zum gleichen Ziel (RSC-Race auf Live). */
export function beginSoftNavFlight(target: string): boolean {
  const normalized = normalizePath(target);
  if (activeTarget === normalized) return false;
  if (releaseTimer) clearTimeout(releaseTimer);
  activeTarget = normalized;
  releaseTimer = setTimeout(() => {
    activeTarget = null;
    releaseTimer = null;
  }, 2500);
  return true;
}

export function endSoftNavFlight(pathname: string): void {
  const normalized = normalizePath(pathname);
  if (activeTarget !== normalized) return;
  activeTarget = null;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
}
