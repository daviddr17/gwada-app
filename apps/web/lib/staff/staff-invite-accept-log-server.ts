import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertStaffAuditLogEntryServer } from "@/lib/staff/staff-audit-log-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

/** Fallback-Protokoll, falls accept_staff_invite auf der DB ohne Log-Eintrag läuft. */
export async function ensureStaffInviteAcceptedLogServer(params: {
  restaurantId: string;
  staffId: string;
  actorUserId: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const restaurantId = params.restaurantId.trim();
  const staffId = params.staffId.trim();
  const actorUserId = params.actorUserId.trim();

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(staffId) ||
    !isUuidRestaurantId(actorUserId)
  ) {
    return { ok: false };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false };
  }

  const { data: staff } = await admin
    .from("restaurant_staff")
    .select("id, profile_id")
    .eq("id", staffId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!staff || staff.profile_id !== actorUserId) {
    return { ok: false };
  }

  const { data: invite } = await admin
    .from("restaurant_staff_invites")
    .select("accepted_at, restaurant_position_id")
    .eq("staff_id", staffId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invite?.accepted_at) {
    return { ok: false };
  }

  const { data: existingLog } = await admin
    .from("restaurant_staff_log_entries")
    .select("id")
    .eq("staff_id", staffId)
    .eq("restaurant_id", restaurantId)
    .eq("action", "invite_accepted")
    .gte("created_at", invite.accepted_at as string)
    .limit(1)
    .maybeSingle();

  if (existingLog?.id) {
    return { ok: true, skipped: true };
  }

  let positionSuffix = "";
  const positionId = invite.restaurant_position_id as string | null;
  if (positionId) {
    const { data: position } = await admin
      .from("restaurant_positions")
      .select("name")
      .eq("id", positionId)
      .maybeSingle();
    const positionName = (position?.name as string | null)?.trim();
    if (positionName) {
      positionSuffix = ` · App-Rolle: ${positionName}`;
    }
  }

  const result = await insertStaffAuditLogEntryServer({
    restaurantId,
    staffId,
    actorUserId,
    action: "invite_accepted",
    details: {
      summary: `Einladung angenommen${positionSuffix}`,
    },
  });

  return { ok: result.ok };
}
