import "server-only";

import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function deleteRestaurantPositionServer(params: {
  restaurantId: string;
  positionId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data: position, error: fetchError } = await admin
    .from("restaurant_positions")
    .select("id, slug")
    .eq("id", params.positionId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (fetchError) {
    console.error("[gwada] delete position fetch", fetchError.message);
    return { ok: false, error: "fetch_failed", status: 500 };
  }
  if (!position) {
    return { ok: false, error: "not_found", status: 404 };
  }
  if (position.slug === "owner") {
    return { ok: false, error: "cannot_delete_owner", status: 409 };
  }

  const { error: inviteError } = await admin
    .from("restaurant_staff_invites")
    .delete()
    .eq("restaurant_id", params.restaurantId)
    .eq("restaurant_position_id", params.positionId);

  if (inviteError) {
    console.error("[gwada] delete position invites", inviteError.message);
    return { ok: false, error: "delete_failed", status: 500 };
  }

  const { data: deletedRows, error: deleteError } = await admin
    .from("restaurant_positions")
    .delete()
    .eq("id", params.positionId)
    .eq("restaurant_id", params.restaurantId)
    .select("id");

  if (deleteError) {
    console.error("[gwada] delete position row", deleteError.message);
    return { ok: false, error: "delete_failed", status: 500 };
  }
  if (!deletedRows?.length) {
    return { ok: false, error: "not_found", status: 404 };
  }

  return { ok: true };
}

export async function handleDeleteRestaurantPositionRequest(
  req: Request,
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    positionId?: string;
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const positionId = body?.positionId?.trim() ?? "";

  if (!restaurantId || !positionId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "roles.manage");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await deleteRestaurantPositionServer({
    restaurantId,
    positionId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true });
}
