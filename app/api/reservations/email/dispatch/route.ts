import { assertPlatformEmailEnabled } from "@/lib/integrations/platform-messaging-guard";
import { emailDispatchResultForClient } from "@/lib/reservations/email-dispatch-client-response";
import { dispatchReservationEmail } from "@/lib/reservations/reservation-email-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

const VALID_EVENTS = new Set([
  "created",
  "confirmed",
  "cancelled",
  "declined",
  "no_show",
]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    reservationId?: string;
    event?: string;
  };

  const reservationId = body.reservationId?.trim() ?? "";
  const event = body.event;
  if (!isUuidRestaurantId(reservationId) || !event || !VALID_EVENTS.has(event)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: reservation } = await userSb
    .from("reservations")
    .select("restaurant_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation?.restaurant_id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { data: allowed } = await userSb.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: reservation.restaurant_id,
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const platform = await assertPlatformEmailEnabled(userSb);
  if (!platform.ok) {
    return Response.json(
      { ok: true, skipped: "email_disabled" },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: isSuperadmin } = await userSb.rpc("auth_is_superadmin");

  const result = await dispatchReservationEmail(
    admin,
    reservationId,
    event as Parameters<typeof dispatchReservationEmail>[2],
  );

  if (!result.ok && result.error) {
    console.warn("[gwada] email dispatch failed", {
      reservationId,
      event,
      error: result.error,
      superadmin: Boolean(isSuperadmin),
    });
  }

  return Response.json(
    emailDispatchResultForClient(result, Boolean(isSuperadmin)),
  );
}
