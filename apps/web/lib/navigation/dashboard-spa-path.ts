/** Dashboard-URL ↔ TanStack Router (basepath `/dashboard`). */

export function tanstackLocationToDashboardPath(pathname: string): string {
  if (pathname === "/" || pathname === "") return "/dashboard";
  return `/dashboard${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function dashboardHrefToTanstackTarget(href: string): {
  to: string;
  search: Record<string, string>;
} {
  const path = href.split("?")[0] ?? href;
  const searchStr = href.includes("?") ? href.split("?")[1] : "";
  const to =
    path === "/dashboard" ? "/" : path.replace(/^\/dashboard/, "") || "/";
  const search: Record<string, string> = {};
  if (searchStr) {
    for (const pair of searchStr.split("&")) {
      const [k, v] = pair.split("=");
      if (k) search[k] = decodeURIComponent(v ?? "");
    }
  }
  return { to, search };
}

export function isDashboardSpaHref(href: string): boolean {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  return path === "/dashboard" || path.startsWith("/dashboard/");
}
