import { cache } from "react";
import {
  DEFAULT_SIDEBAR_MODULE_ORDER,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import { fetchSidebarModuleOrder } from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCachedSidebarModuleOrder = cache(
  async (): Promise<SidebarModuleId[]> => {
    const sb = await createSupabaseServerClient();
    if (!sb) {
      return [...DEFAULT_SIDEBAR_MODULE_ORDER];
    }
    return fetchSidebarModuleOrder(sb);
  },
);
