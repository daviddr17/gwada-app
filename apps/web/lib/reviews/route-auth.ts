import "server-only";

import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import type { ModuleCrudOperation } from "@/lib/permissions/module-crud-permissions";

export async function authorizeReviewsRestaurant(
  restaurantId: string,
  operation: ModuleCrudOperation = "read",
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
  | { ok: false; status: number }
> {
  const auth = await authorizeModuleCrud(restaurantId, "reviews", operation);
  if (!auth.ok) {
    return { ok: false, status: auth.status };
  }
  return { ok: true, sb: auth.sb, userId: auth.userId };
}
