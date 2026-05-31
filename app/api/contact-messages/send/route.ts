import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    contactId?: string;
    messageBody?: string;
    direction?: "inbound" | "outbound";
    channels?: ("gwada" | "whatsapp" | "email")[];
    reservationId?: string | null;
    restaurantName?: string | null;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const contactId = body.contactId?.trim() ?? "";
  const messageBody = body.messageBody?.trim() ?? "";
  const direction = body.direction;
  const channels = body.channels ?? [];

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(contactId) ||
    !messageBody ||
    (direction !== "inbound" && direction !== "outbound") ||
    channels.length === 0
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: allowed } = await userSb.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: restaurantId,
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: contact } = await userSb
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!contact) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const reservationId = body.reservationId?.trim() || null;
  if (reservationId && !isUuidRestaurantId(reservationId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await sendContactMessageServer(admin, {
    restaurantId,
    contactId,
    body: messageBody,
    direction,
    channels: [...new Set(channels)],
    reservationId,
    sentBy: direction === "outbound" ? user.id : null,
    restaurantName: body.restaurantName?.trim() || null,
  });

  return Response.json(result);
}
