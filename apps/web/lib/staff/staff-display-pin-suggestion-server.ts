import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function isRestaurantDisplayPinAvailable(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  pin: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("resolve_restaurant_staff_by_display_pin", {
    p_restaurant_id: restaurantId,
    p_pin: pin,
  });
  if (error) return false;
  return data == null;
}

export async function suggestRestaurantDisplayPin(
  restaurantId: string,
): Promise<{ pin: string | null; error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { pin: null, error: "server_misconfigured" };
  }

  const { count, error: countError } = await admin
    .from("restaurant_staff")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .not("display_pin_hash", "is", null);

  if (countError) {
    return { pin: null, error: countError.message };
  }

  const startCandidate = Math.min(9999, Math.max(1000, 1000 + (count ?? 0)));

  for (let candidate = startCandidate; candidate <= 9999; candidate += 1) {
    const pin = String(candidate).padStart(4, "0");
    if (await isRestaurantDisplayPinAvailable(admin, restaurantId, pin)) {
      return { pin, error: null };
    }
  }

  return { pin: null, error: "no_pin_available" };
}
