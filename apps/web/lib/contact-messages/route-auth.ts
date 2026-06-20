import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function authorizeContactMessagesRestaurant(
  restaurantIdRaw: string | null,
): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      restaurantId: string;
      userId: string;
    }
  | { ok: false; status: number; error: string }
> {
  const restaurantId = restaurantIdRaw?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const auth = await authorizeModuleCrud(restaurantId, "contacts", "read");
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  return {
    ok: true,
    supabase: auth.sb,
    restaurantId,
    userId: auth.userId,
  };
}
