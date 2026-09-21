function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/** Path segment without query/hash — for same-route search-only navigation. */
export function pathOnlyFromNavHref(href: string): string {
  const hash = href.indexOf("#");
  const withoutHash = hash === -1 ? href : href.slice(0, hash);
  const q = withoutHash.indexOf("?");
  const path = q === -1 ? withoutHash : withoutHash.slice(0, q);
  return normalizePath(path);
}

/** True when `toHref` only changes query/hash on the current pathname. */
export function isSamePathSearchNav(
  currentPathname: string,
  toHref: string,
): boolean {
  return pathOnlyFromNavHref(currentPathname) === pathOnlyFromNavHref(toHref);
}
