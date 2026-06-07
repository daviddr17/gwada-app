import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchWahaThreadMessages } from "@/lib/contact-messages/waha-inbox-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const contactId = searchParams.get("contactId")?.trim() ?? "";
  const chatId = searchParams.get("chatId")?.trim() || null;

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!contactId && !chatId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const effectiveContactId =
    contactId ||
    (chatId ? `waha:${chatId}` : "");

  const isWahaPseudo = effectiveContactId.startsWith("waha:");
  if (!isWahaPseudo && !isUuidRestaurantId(effectiveContactId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await fetchWahaThreadMessages(admin, {
    restaurantId: auth.restaurantId,
    contactId: effectiveContactId,
    chatIdOverride: chatId,
  });

  if (result.error) {
    return Response.json({ error: result.error, data: [] }, { status: 502 });
  }
  return Response.json({ data: result.data });
}
