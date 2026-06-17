export const GWADA_SUPERADMIN_CHANGELOG_REFRESH_EVENT =
  "gwada:superadmin-changelog-refresh";

export function dispatchSuperadminChangelogRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_SUPERADMIN_CHANGELOG_REFRESH_EVENT));
}
