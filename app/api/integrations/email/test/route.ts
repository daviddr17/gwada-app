import { assertPlatformEmailEnabled } from "@/lib/integrations/platform-messaging-guard";
import { isEmailSendConfigured } from "@/lib/email/is-email-send-configured";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    to?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const to = body.to?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!isEmailSendConfigured()) {
    return Response.json({ error: "email_send_not_configured" }, { status: 503 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const platform = await assertPlatformEmailEnabled(sb);
  if (!platform.ok) {
    return Response.json({ error: platform.error }, { status: 403 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.email",
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const recipient = to || user.email?.trim() || "";
  if (!recipient.includes("@")) {
    return Response.json({ error: "no_recipient" }, { status: 400 });
  }

  const delivery = await resolveEmailDeliveryForRestaurant(restaurantId);
  if (!delivery) {
    return Response.json({ error: "smtp_not_configured" }, { status: 400 });
  }

  const text = `Dies ist eine Test-E-Mail von Gwada.\n\nAbsender-Modus: ${delivery.sender.mode}\nVon: ${delivery.sender.name} <${delivery.sender.email}>`;
  const result = await sendReservationEmail(delivery, {
    to: recipient,
    subject: "Gwada — Test-E-Mail Reservierungen",
    text,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({ ok: true });
}
