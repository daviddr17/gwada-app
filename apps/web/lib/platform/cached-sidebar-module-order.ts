import { cache } from "react";
import {
  DEFAULT_SIDEBAR_MODULE_ORDER,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import { fetchSidebarModuleOrder } from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SIDEBAR_ORDER_FETCH_TIMEOUT_MS = 2_500;

export const getCachedSidebarModuleOrder = cache(
  async (): Promise<SidebarModuleId[]> => {
    try {
      const sb = await createSupabaseServerClient();
      if (!sb) {
        return [...DEFAULT_SIDEBAR_MODULE_ORDER];
      }
      return await Promise.race([
        fetchSidebarModuleOrder(sb),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("sidebar_module_order_fetch_timeout")),
            SIDEBAR_ORDER_FETCH_TIMEOUT_MS,
          );
        }),
      ]);
    } catch {
      return [...DEFAULT_SIDEBAR_MODULE_ORDER];
    }
  },
);
