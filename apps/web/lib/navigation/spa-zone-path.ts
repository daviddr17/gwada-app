/** Zone SPA URL ↔ TanStack Router (basepath `/dashboard` | `/superadmin`). */

export type SpaZoneBase = "/dashboard" | "/superadmin";

export function tanstackLocationToZonePath(
  base: SpaZoneBase,
  pathname: string,
): string {
  if (pathname === "/" || pathname === "") return base;
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function zoneHrefToTanstackTarget(
  base: SpaZoneBase,
  href: string,
): { to: string; search: Record<string, string> } {
  const path = href.split("?")[0] ?? href;
  const searchStr = href.includes("?") ? href.split("?")[1] : "";
  const prefix = `${base}/`;
  const to =
    path === base
      ? "/"
      : path.startsWith(prefix)
        ? path.slice(base.length) || "/"
        : path.replace(new RegExp(`^${base}`), "") || "/";
  const search: Record<string, string> = {};
  if (searchStr) {
    for (const pair of searchStr.split("&")) {
      const [k, v] = pair.split("=");
      if (k) search[k] = decodeURIComponent(v ?? "");
    }
  }
  return { to, search };
}

export function isZoneSpaHref(base: SpaZoneBase, href: string): boolean {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  return path === base || path.startsWith(`${base}/`);
}

export function spaZoneFromHref(href: string): SpaZoneBase | null {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "/dashboard";
  if (path === "/superadmin" || path.startsWith("/superadmin/")) return "/superadmin";
  return null;
}
