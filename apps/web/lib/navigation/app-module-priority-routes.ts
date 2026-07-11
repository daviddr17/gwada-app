import { SIDEBAR_MODULE_DEFINITIONS } from "@/lib/constants/sidebar-modules";

/** Sidebar-Ziele — einzige Quelle für Priority-Prefetch (keine englischen Pfad-Typo). */
export const APP_MODULE_PRIORITY_ROUTES: readonly string[] =
  SIDEBAR_MODULE_DEFINITIONS.map((mod) => mod.href);
