"use client";

/**
 * Compat — Keep-alive liegt in {@link module-home-keep-alive-context}.
 * @deprecated Importiere aus `@/lib/contexts/module-home-keep-alive-context`.
 */

export {
  ModuleHomeKeepAliveProvider as DashboardHomeKeepAliveProvider,
  useDashboardHomeKeepAliveOptional,
  type ModuleHomeSlotState as DashboardHomeKeepAliveValue,
} from "@/lib/contexts/module-home-keep-alive-context";

import { useModuleHomeSlot } from "@/lib/contexts/module-home-keep-alive-context";

export function useDashboardHomeKeepAlive() {
  return useModuleHomeSlot("dashboard");
}
