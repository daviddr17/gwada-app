import { ensureStaffInviteAcceptedLogServer } from "@/lib/staff/staff-invite-accept-log-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    staffId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const staffId = body.staffId?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(staffId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await ensureStaffInviteAcceptedLogServer({
    restaurantId,
    staffId,
    actorUserId: user.id,
  });

  if (!result.ok) {
    return Response.json({ error: "audit_failed" }, { status: 403 });
  }

  return Response.json({ ok: true, skipped: result.skipped ?? false });
}
