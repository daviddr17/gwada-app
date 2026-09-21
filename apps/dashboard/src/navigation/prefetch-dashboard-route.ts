import { dashboardHrefToTanstackTarget, isDashboardSpaHref } from "@/lib/navigation/dashboard-spa-path";
import { dashboardRouter } from "../router/route-tree";

/** TanStack: Route-Chunk + Daten vor Navigation laden (Hover / Sidebar-Intent). */
export function prefetchDashboardSpaHref(href: string): void {
  if (!isDashboardSpaHref(href)) return;
  const { to, search } = dashboardHrefToTanstackTarget(href);
  const tanstackTo =
    Object.keys(search).length > 0
      ? `${to}?${new URLSearchParams(search).toString()}`
      : to;
  void dashboardRouter.preloadRoute({ to: tanstackTo }).catch(() => {
    /* Offline / unbekannte Route — Navigation bleibt möglich. */
  });
}
