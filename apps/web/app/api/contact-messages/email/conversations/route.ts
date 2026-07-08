import { fetchEmailInboxConversations } from "@/lib/contact-messages/email-inbox-service";
import { mergeUnreadIntoConversations } from "@/lib/contact-messages/merge-conversation-unread";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchCommunalConversationReadsAdmin, fetchConversationReadsForUser } from "@/lib/supabase/contact-conversation-reads-db";
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

  const result = await fetchEmailInboxConversations(admin, auth.restaurantId);
  if (result.error) {
    return Response.json({ error: result.error, data: [] }, { status: 502 });
  }

  const [reads, communalReads] = await Promise.all([
    fetchConversationReadsForUser(admin, {
      restaurantId: auth.restaurantId,
      userId: auth.userId,
      platform: "email",
    }),
    fetchCommunalConversationReadsAdmin(admin, {
      restaurantId: auth.restaurantId,
    }),
  ]);
  const data = mergeUnreadIntoConversations(
    result.data,
    reads,
    "email",
    communalReads,
  );
  return Response.json({ data });
}
