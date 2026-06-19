import "server-only";

import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function authorizeEventsRestaurant(
  restaurantId: string,
  opts?: { requireManage?: boolean },
): Promise<
  | {
      ok: true;
      sb: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      userId: string;
    }
  | { ok: false; status: number; error: string }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "unauthorized" };

  if (opts?.requireManage) {
    const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
      p_restaurant_id: restaurantId,
      p_permission: "events.manage",
    });
    if (!allowed) return { ok: false, status: 403, error: "forbidden" };
  } else {
    const { data: staff } = await sb.rpc("auth_is_restaurant_staff", {
      p_restaurant_id: restaurantId,
    });
    if (!staff) return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, sb, userId: user.id };
}
