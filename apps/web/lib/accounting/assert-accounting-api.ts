import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAccountingApi(restaurantId: string): Promise<
  | { ok: true; userId: string; sb: SupabaseClient; restaurantId: string }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "accounting.manage",
  });
  if (!allowed) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, userId: user.id, sb, restaurantId };
}

export function restaurantIdFromRequest(
  req: Request,
  body?: { restaurantId?: string },
): string {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("restaurantId")?.trim();
  if (fromQuery) return fromQuery;
  return body?.restaurantId?.trim() ?? "";
}
