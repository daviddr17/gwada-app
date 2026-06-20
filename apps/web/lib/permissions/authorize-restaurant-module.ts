import "server-only";

import {
  moduleCrudKey,
  type ModuleCrudOperation,
  type ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function authorizeRestaurantModule(
  restaurantId: string,
  permission: RestaurantPermissionKey,
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

  const { data: allowed, error } = await sb.rpc(
    "auth_has_restaurant_permission",
    {
      p_restaurant_id: restaurantId,
      p_permission: permission,
    },
  );

  if (error) {
    console.warn("auth_has_restaurant_permission", error.message);
    return { ok: false, status: 500, error: "permission_check_failed" };
  }

  if (!allowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, sb, userId: user.id };
}

export async function authorizeModuleCrud(
  restaurantId: string,
  prefix: ModuleCrudPrefix,
  operation: ModuleCrudOperation,
) {
  return authorizeRestaurantModule(
    restaurantId,
    moduleCrudKey(prefix, operation),
  );
}
