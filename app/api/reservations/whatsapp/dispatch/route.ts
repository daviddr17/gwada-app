import { dispatchReservationWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    reservationId?: string;
    event?:
      | "created"
      | "confirmed"
      | "cancelled"
      | "declined"
      | "no_show";
  };

  const reservationId = body.reservationId?.trim() ?? "";
  const event = body.event;
  const validEvents = new Set([
    "created",
    "confirmed",
    "cancelled",
    "declined",
    "no_show",
  ]);
  if (!isUuidRestaurantId(reservationId) || !event || !validEvents.has(event)) {
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

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await dispatchReservationWhatsapp(admin, reservationId, event);
  return Response.json(result);
}
