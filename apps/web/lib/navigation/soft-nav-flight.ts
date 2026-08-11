/**
 * Soft-Nav in flight → Background FULL-Prefetch pausieren,
 * damit router.push nicht hinter Dutzenden Prefetch-Flights hängt.
 */
let softNavTargetNormalized: string | null = null;

function normalize(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

export function beginSoftNavFlight(href: string): void {
  softNavTargetNormalized = normalize(href);
}

export function endSoftNavFlight(): void {
  softNavTargetNormalized = null;
}

export function isSoftNavFlightActive(): boolean {
  return softNavTargetNormalized != null;
}

/** Background-Prefetch anderer Routen während Soft-Nav unterdrücken. */
export function shouldSkipBackgroundModulePrefetch(href: string): boolean {
  if (softNavTargetNormalized == null) return false;
  return normalize(href) !== softNavTargetNormalized;
}
