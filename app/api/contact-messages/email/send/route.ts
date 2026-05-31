import { sendEmailInboxMessageServer } from "@/lib/contact-messages/send-email-inbox-server";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    emailContactId?: string;
    contactId?: string;
    messageBody?: string;
    restaurantName?: string | null;
    storeUnderContact?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const messageBody = body.messageBody?.trim() ?? "";
  const emailContactId = body.emailContactId?.trim() ?? "";
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

  let targetId = "";
  if (isUuidRestaurantId(contactId)) {
    const { data: contact } = await auth.supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!contact) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    targetId = contactId;
  } else if (isEmailPseudoContactId(emailContactId)) {
    targetId = emailContactId;
  } else {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await sendEmailInboxMessageServer(admin, {
    restaurantId,
    contactId: targetId,
    body: messageBody,
    sentBy: auth.userId,
    restaurantName: body.restaurantName?.trim() || null,
    storeUnderContact: isUuidRestaurantId(contactId)
      ? body.storeUnderContact !== false
      : false,
  });

  return Response.json(result);
}
