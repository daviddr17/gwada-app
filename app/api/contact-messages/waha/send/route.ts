import { sendWahaMessageServer } from "@/lib/contact-messages/send-waha-message-server";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    wahaContactId?: string;
    contactId?: string;
    messageBody?: string;
    storeUnderContact?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const messageBody = body.messageBody?.trim() ?? "";
  const wahaContactId = body.wahaContactId?.trim() ?? "";
  const contactId = body.contactId?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !messageBody) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  if (isUuidRestaurantId(contactId) && body.storeUnderContact !== false) {
    const { data: contact } = await auth.supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (!contact) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const result = await sendContactMessageServer(admin, {
      restaurantId,
      contactId,
      body: messageBody,
      direction: "outbound",
      channels: ["whatsapp"],
      sentBy: auth.userId,
    });
    return Response.json(result);
  }

  if (!isWahaPseudoContactId(wahaContactId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await sendWahaMessageServer({
    restaurantId,
    wahaContactId,
    body: messageBody,
  });

  return Response.json(result);
}
