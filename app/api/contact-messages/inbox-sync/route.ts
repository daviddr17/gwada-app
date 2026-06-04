import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { syncContactInbox } from "@/lib/contacts/sync-contact-inbox-server";
import { syncRestaurantEmailInbox } from "@/lib/contacts/sync-restaurant-email-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    contactId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const contactId = body.contactId?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
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

  if (contactId && isUuidRestaurantId(contactId)) {
    const result = await syncContactInbox(admin, { restaurantId, contactId });
    return Response.json({
      ok: result.errors.length === 0,
      emailImported: result.emailImported,
      whatsappImported: result.whatsappImported,
      imported: result.emailImported + result.whatsappImported,
      errors: result.errors,
    });
  }

  const email = await syncRestaurantEmailInbox(admin, restaurantId);
  return Response.json({
    ok: !email.error,
    emailImported: email.imported,
    imported: email.imported,
    errors: email.error ? [email.error] : [],
  });
}
