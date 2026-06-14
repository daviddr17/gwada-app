import {
  DEFAULT_SIDEBAR_MODULE_ORDER,
  normalizeSidebarModuleOrder,
} from "@/lib/constants/sidebar-modules";
import { fetchSidebarModuleOrder } from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  if (!sb) {
    return Response.json({ order: [...DEFAULT_SIDEBAR_MODULE_ORDER] });
  }

  const order = await fetchSidebarModuleOrder(sb);
  return Response.json({ order });
}
