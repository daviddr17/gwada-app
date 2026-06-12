import { fetchMetaThreadMessages } from "@/lib/contact-messages/meta-inbox-service";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const contactId = url.searchParams.get("contactId");
  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!contactId?.trim()) {
    return Response.json({ error: "missing_contact" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await fetchMetaThreadMessages(admin, {
    restaurantId: auth.restaurantId,
    contactId: contactId.trim(),
  });
  if (result.error) {
    return Response.json({ error: result.error, data: [] }, { status: 502 });
  }

  return Response.json({ data: result.data });
}
