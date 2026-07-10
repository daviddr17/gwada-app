import {
  SIDEBAR_MODULE_DEFINITIONS,
  type SidebarModuleDefinition,
} from "@/lib/constants/sidebar-modules";

/** Hero-Pills — gleiche Module wie in der App-Sidebar (ohne Dashboard). */
export const LANDING_APP_MODULES: readonly Pick<
  SidebarModuleDefinition,
  "label" | "icon"
>[] = SIDEBAR_MODULE_DEFINITIONS.map(({ label, icon }) => ({ label, icon }));
