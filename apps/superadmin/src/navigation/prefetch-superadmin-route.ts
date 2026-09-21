import {
  isZoneSpaHref,
  zoneHrefToTanstackTarget,
} from "@/lib/navigation/spa-zone-path";
import { superadminRouter } from "../router/route-tree";

/** TanStack: Route-Chunk + Daten vor Navigation laden (Hover / Sidebar-Intent). */
export function prefetchSuperadminSpaHref(href: string): void {
  if (!isZoneSpaHref("/superadmin", href)) return;
  const { to, search } = zoneHrefToTanstackTarget("/superadmin", href);
  const tanstackTo =
    Object.keys(search).length > 0
      ? `${to}?${new URLSearchParams(search).toString()}`
      : to;
  void superadminRouter.preloadRoute({ to: tanstackTo }).catch(() => {
    /* Offline / unbekannte Route — Navigation bleibt möglich. */
  });
}
