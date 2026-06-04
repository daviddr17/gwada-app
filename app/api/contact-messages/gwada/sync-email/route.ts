import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { syncContactInbox } from "@/lib/contacts/sync-contact-inbox-server";
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

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(contactId)) {
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

  const result = await syncContactInbox(admin, { restaurantId, contactId });

  if (result.errors.length > 0) {
    return Response.json({ error: result.errors[0], errors: result.errors }, { status: 500 });
  }

  return Response.json({
    ok: true,
    imported: result.emailImported + result.whatsappImported,
    emailImported: result.emailImported,
    whatsappImported: result.whatsappImported,
  });
}
