import { SIDEBAR_MODULE_DEFINITIONS } from "@/lib/constants/sidebar-modules";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

function collectRouteStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    out.add(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const nested of Object.values(value)) {
    collectRouteStrings(nested, out);
  }
}

const ROUTE_SET = new Set<string>([
  "/dashboard",
  APP_ROUTES.settings.root,
  "/changelog",
  ...SIDEBAR_MODULE_DEFINITIONS.map((mod) => mod.href),
]);

collectRouteStrings(APP_ROUTES, ROUTE_SET);

/** Alle App-Routen für Next.js Full-Prefetch (Soft-Nav-Flights). */
export const APP_MODULE_PREFETCH_ROUTES: readonly string[] = [...ROUTE_SET];

export function prefetchAppModuleRoutes(
  prefetch: (href: string) => void,
): void {
  for (const href of APP_MODULE_PREFETCH_ROUTES) {
    prefetch(href);
  }
}
