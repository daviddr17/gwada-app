import { SIDEBAR_MODULE_DEFINITIONS } from "@/lib/constants/sidebar-modules";

/** Alle Modul-Einstiegsrouten für Next.js router.prefetch (Soft-Nav-Flights). */
export const APP_MODULE_PREFETCH_ROUTES: readonly string[] = [
  "/dashboard",
  ...SIDEBAR_MODULE_DEFINITIONS.map((mod) => mod.href),
  "/settings",
  "/changelog",
];

export function prefetchAppModuleRoutes(
  prefetch: (href: string) => void,
): void {
  for (const href of APP_MODULE_PREFETCH_ROUTES) {
    prefetch(href);
  }
}
