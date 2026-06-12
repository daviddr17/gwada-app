import { fetchMetaInboxConversations } from "@/lib/contact-messages/meta-inbox-service";
import { mergeUnreadIntoConversations } from "@/lib/contact-messages/merge-conversation-unread";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchConversationReadsForUser } from "@/lib/supabase/contact-conversation-reads-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const platform = url.searchParams.get("platform");
  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (platform !== "facebook" && platform !== "instagram") {
    return Response.json({ error: "invalid_platform" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await fetchMetaInboxConversations(
    admin,
    auth.restaurantId,
    platform,
  );
  if (result.error) {
    return Response.json({ error: result.error, data: [] }, { status: 502 });
  }

  const reads = await fetchConversationReadsForUser(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    platform,
  });
  const data = mergeUnreadIntoConversations(result.data, reads, platform);
  return Response.json({ data });
}
