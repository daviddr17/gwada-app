import { linkEmailThreadToContact } from "@/lib/contact-messages/link-email-thread-server";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    emailPseudoContactId?: string;
    contactId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const emailPseudoContactId = body.emailPseudoContactId?.trim() ?? "";
  const contactId = body.contactId?.trim() ?? "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(contactId) ||
    !isEmailPseudoContactId(emailPseudoContactId)
  ) {
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

  const result = await linkEmailThreadToContact(admin, {
    restaurantId,
    contactId,
    emailPseudoContactId,
  });

  if (result.error) {
    return Response.json(
      { ok: false, error: result.error, imported: result.imported },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, imported: result.imported });
}
