import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { insertStaffAuditLogEntryServer } from "@/lib/staff/staff-audit-log-server";
import {
  createStaffInviteAdmin,
  getStaffInviteAdminClient,
} from "@/lib/staff/staff-invite-preview-server";
import { staffInviteUrl } from "@/lib/staff/staff-invite-server";
import { resolveStaffInviteContactConflicts } from "@/lib/staff/staff-invite-contact-conflict-server";
import {
  sendStaffInviteEmail,
  sendStaffInviteWhatsapp,
} from "@/lib/staff/staff-invite-send-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

type StaffInviteAction = "copy" | "whatsapp" | "email";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    staffId?: string;
    restaurantPositionId?: string;
    action?: StaffInviteAction;
    /** @deprecated use action */
    channel?: "email" | "whatsapp";
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const staffId = body.staffId?.trim() ?? "";
  const restaurantPositionId = body.restaurantPositionId?.trim() ?? "";
  const action: StaffInviteAction =
    body.action === "copy" ||
    body.action === "whatsapp" ||
    body.action === "email"
      ? body.action
      : body.channel === "whatsapp"
        ? "whatsapp"
        : "copy";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(staffId) ||
    !isUuidRestaurantId(restaurantPositionId)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const userSb = await createSupabaseServerClient();
  const { data: staff } = await userSb
    .from("restaurant_staff")
    .select("id, email, phone, given_name, family_name, profile_id")
    .eq("id", staffId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!staff) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (staff.profile_id) {
    return Response.json({ error: "already_connected" }, { status: 409 });
  }

  const channel = action === "whatsapp" ? "whatsapp" : "email";

  if (action === "email" && !staff.email?.trim()) {
    return Response.json({ error: "no_email" }, { status: 400 });
  }
  if (action === "whatsapp" && !staff.phone?.trim()) {
    return Response.json({ error: "no_phone" }, { status: 400 });
  }

  if (action === "whatsapp" || action === "email") {
    const conflicts = await resolveStaffInviteContactConflicts(userSb, {
      restaurantId,
      staffId,
      email: staff.email,
      phone: staff.phone,
    });
    const conflict =
      action === "email" ? conflicts.emailConflict : conflicts.phoneConflict;
    if (conflict) {
      return Response.json(
        {
          error: "contact_already_connected",
          conflictKind: conflict.kind,
          label: conflict.label,
          staffName: conflict.staffName ?? null,
        },
        { status: 409 },
      );
    }
  }

  const invite = await (async () => {
    const admin = await getStaffInviteAdminClient();
    if (!admin) return null;
    return createStaffInviteAdmin(admin, {
      restaurantId,
      staffId,
      restaurantPositionId,
      channel,
      createdBy: auth.userId,
    });
  })();

  if (!invite) {
    return Response.json({ error: "invite_failed" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const url = staffInviteUrl(origin, invite.token);

  const { data: restaurant } = await userSb
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();

  const restaurantName = (restaurant?.name as string) ?? "Restaurant";
  const staffName = [staff.given_name, staff.family_name]
    .filter(Boolean)
    .join(" ");

  if (action === "copy") {
    return Response.json({
      ok: true,
      inviteUrl: url,
      action,
    });
  }

  if (action === "whatsapp") {
    const sent = await sendStaffInviteWhatsapp({
      restaurantId,
      phone: staff.phone as string,
      staffName,
      restaurantName,
      inviteUrl: url,
    });
    if (!sent.ok) {
      return Response.json({ error: sent.error }, { status: 502 });
    }
    await insertStaffAuditLogEntryServer({
      restaurantId,
      staffId,
      actorUserId: auth.userId,
      action: "invite_whatsapp",
      sessionSupabase: userSb,
      details: {
        summary: `Einladung per WhatsApp versendet an ${staff.phone}`,
      },
    });
    return Response.json({
      ok: true,
      inviteUrl: url,
      action,
      sent: true,
    });
  }

  const sent = await sendStaffInviteEmail({
    restaurantId,
    to: staff.email as string,
    staffName,
    restaurantName,
    inviteUrl: url,
    sbForName: userSb,
  });
  if (!sent.ok) {
    return Response.json({ error: sent.error }, { status: 502 });
  }
  await insertStaffAuditLogEntryServer({
    restaurantId,
    staffId,
    actorUserId: auth.userId,
    action: "invite_email",
    sessionSupabase: userSb,
    details: {
      summary: `Einladung per E-Mail versendet an ${staff.email}`,
    },
  });

  return Response.json({
    ok: true,
    inviteUrl: url,
    action,
    sent: true,
  });
}
