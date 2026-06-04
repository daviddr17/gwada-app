import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function authorizeRestaurantMemberRoute(
  restaurantIdRaw: string | null,
): Promise<
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string }
> {
  const restaurantId = restaurantIdRaw?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_restaurant_id" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const { data: member, error: memberError } = await supabase
    .from("restaurant_employees")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (memberError) {
    console.warn("[gwada] restaurant_employees", memberError.message);
    return { ok: false, status: 403, error: "forbidden" };
  }

  if (!member) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, restaurantId };
}
