import { mergeUnreadIntoConversations } from "@/lib/contact-messages/merge-conversation-unread";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchWahaInboxConversations } from "@/lib/contact-messages/waha-inbox-service";
import { fetchConversationReadsForUser } from "@/lib/supabase/contact-conversation-reads-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await fetchWahaInboxConversations(admin, auth.restaurantId);
  if (result.error) {
    return Response.json({ error: result.error, data: [] }, { status: 502 });
  }

  const reads = await fetchConversationReadsForUser(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    platform: "whatsapp",
  });
  const data = mergeUnreadIntoConversations(
    result.data,
    reads,
    "whatsapp",
  );
  return Response.json({ data });
}
