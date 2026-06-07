import { fetchEmailInboxThread } from "@/lib/contact-messages/email-inbox-service";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const contactId = searchParams.get("contactId")?.trim() ?? "";

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!contactId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await fetchEmailInboxThread(admin, {
    restaurantId: auth.restaurantId,
    contactId,
  });

  if (result.error) {
    return Response.json({ error: result.error, data: [] }, { status: 502 });
  }
  return Response.json({ data: result.data });
}
