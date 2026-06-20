import "server-only";

import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";

export async function authorizeReservationSettingsRestaurant(
  restaurantId: string,
): Promise<
  | { ok: true; sb: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>> }
  | { ok: false; status: number; error: string }
> {
  const auth = await authorizeModuleCrud(restaurantId, "reservations", "update");
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  return { ok: true, sb: auth.sb };
}
