import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

export type GalleryPermission =
  | "gallery.read"
  | "gallery.create"
  | "gallery.update"
  | "gallery.delete";

export async function authorizeGalleryRestaurant(
  restaurantId: string,
  opts?: { permission?: GalleryPermission },
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

  const permission: RestaurantPermissionKey = opts?.permission ?? "gallery.read";

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: permission,
  });
  if (!allowed) return { ok: false, status: 403, error: "forbidden" };

  return { ok: true, sb, userId: user.id };
}
