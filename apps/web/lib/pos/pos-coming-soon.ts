/**
 * Native POS is not public yet (Add-on still `comingSoon` in the catalog).
 * Superadmins keep full Dashboard access for review and development.
 */
export function isPosLiveForViewer(isSuperadmin: boolean): boolean {
  return isSuperadmin === true;
}

export function isPosComingSoonForViewer(isSuperadmin: boolean): boolean {
  return !isPosLiveForViewer(isSuperadmin);
}
