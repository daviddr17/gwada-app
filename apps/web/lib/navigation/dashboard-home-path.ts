export function normalizeDashboardPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isDashboardHomePath(pathname: string): boolean {
  return normalizeDashboardPath(pathname) === "/dashboard";
}
