import "server-only";

import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import type { ModuleCrudOperation } from "@/lib/permissions/module-crud-permissions";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAccountingApi(
  restaurantId: string,
  operation: ModuleCrudOperation = "read",
): Promise<
  | { ok: true; userId: string; sb: SupabaseClient; restaurantId: string }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const auth = await authorizeModuleCrud(restaurantId, "accounting", operation);
  if (!auth.ok) {
    return { ok: false, error: auth.error, status: auth.status };
  }

  return {
    ok: true,
    userId: auth.userId,
    sb: auth.sb,
    restaurantId,
  };
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
