import { NextResponse } from "next/server";
import { emitStaffPermissionsGrantedForTargets } from "@/lib/notifications/notification-staff-permissions-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

type NotifyBody = {
  restaurantId?: string;
  /** Neue Keys, die gerade vergeben wurden. */
  addedKeys?: string[];
  /** Alle Mitarbeiter dieser Position benachrichtigen. */
  positionId?: string;
  /** Einzelnen Mitarbeiter benachrichtigen (Rollenwechsel). */
  profileId?: string;
  positionName?: string | null;
};

export async function POST(req: Request) {
  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const addedKeys = Array.isArray(body.addedKeys)
    ? body.addedKeys.filter(
        (k): k is string => typeof k === "string" && k.length > 0,
      )
    : [];
  const positionId =
    typeof body.positionId === "string" ? body.positionId.trim() : "";
  const profileId =
    typeof body.profileId === "string" ? body.profileId.trim() : "";
  const positionName =
    typeof body.positionName === "string" ? body.positionName.trim() : null;

  if (!isUuidRestaurantId(restaurantId) || addedKeys.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!positionId && !profileId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "roles.manage",
  });
  let teamAllowed = false;
  if (!allowed) {
    const team = await sb.rpc("auth_has_restaurant_permission", {
      p_restaurant_id: restaurantId,
      p_permission: "team.manage",
    });
    teamAllowed = Boolean(team.data);
  }
  if (!allowed && !teamAllowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 503 },
    );
  }

  const targets: { profileId: string; restaurantId: string }[] = [];

  if (profileId) {
    const { data: emp } = await admin
      .from("restaurant_employees")
      .select("profile_id")
      .eq("restaurant_id", restaurantId)
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .maybeSingle();
    if (emp?.profile_id) {
      targets.push({ profileId: emp.profile_id as string, restaurantId });
    }
  } else if (positionId) {
    const { data: emps } = await admin
      .from("restaurant_employees")
      .select("profile_id")
      .eq("restaurant_id", restaurantId)
      .eq("position_id", positionId)
      .eq("is_active", true);
    for (const row of emps ?? []) {
      const pid = (row as { profile_id: string | null }).profile_id;
      if (pid) targets.push({ profileId: pid, restaurantId });
    }
  }

  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      notified: 0,
      unlockIds: [] as string[],
    });
  }

  const result = await emitStaffPermissionsGrantedForTargets(admin, {
    restaurantId,
    actorUserId: user.id,
    addedKeys,
    positionName,
    targets,
  });

  return NextResponse.json({
    ok: true,
    notified: result.unlockIds.length,
    unlockIds: result.unlockIds,
  });
}
