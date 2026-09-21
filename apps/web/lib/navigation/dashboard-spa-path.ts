/** @deprecated Prefer spa-zone-path — kept for existing dashboard imports. */
import {
  isZoneSpaHref,
  tanstackLocationToZonePath,
  zoneHrefToTanstackTarget,
} from "@/lib/navigation/spa-zone-path";

export function tanstackLocationToDashboardPath(
  pathname: string | null | undefined,
): string {
  return tanstackLocationToZonePath("/dashboard", pathname);
}

export function dashboardHrefToTanstackTarget(href: string): {
  to: string;
  search: Record<string, string>;
} {
  return zoneHrefToTanstackTarget("/dashboard", href);
}

export function isDashboardSpaHref(href: string): boolean {
  return isZoneSpaHref("/dashboard", href);
}
