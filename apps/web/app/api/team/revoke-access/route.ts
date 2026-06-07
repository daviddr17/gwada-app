import { assertRestaurantPermissionApi } from "@/lib/documents/assert-restaurant-permission-api";
import { revokeRestaurantMemberAccess } from "@/lib/staff/revoke-restaurant-member-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    staffId?: string;
    employeeId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const staffId = body.staffId?.trim() ?? "";
  const employeeId = body.employeeId?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!isUuidRestaurantId(staffId) && !isUuidRestaurantId(employeeId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantPermissionApi(restaurantId, "team.manage");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_config" }, { status: 500 });
  }

  const result = await revokeRestaurantMemberAccess(admin, {
    restaurantId,
    actorUserId: auth.userId,
    staffId: isUuidRestaurantId(staffId) ? staffId : undefined,
    employeeId: isUuidRestaurantId(employeeId) ? employeeId : undefined,
  });

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "forbidden" ||
            result.error === "cannot_revoke_self" ||
            result.error === "last_owner"
          ? 403
          : result.error === "already_revoked"
            ? 409
            : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({
    ok: true,
    staffId: result.staffId,
    profileLabel: result.profileLabel,
  });
}
