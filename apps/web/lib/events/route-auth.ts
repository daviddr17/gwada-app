import "server-only";

import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function authorizeEventsRestaurant(
  restaurantId: string,
  opts?: { requireManage?: boolean },
): Promise<
  | {
      ok: true;
      sb: Awaited<
        ReturnType<
          typeof import("@/lib/supabase/server").createSupabaseServerClient
        >
      >;
      userId: string;
    }
  | { ok: false; status: number; error: string }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const operation = opts?.requireManage ? "create" : "read";
  return authorizeModuleCrud(restaurantId, "events", operation);
}
