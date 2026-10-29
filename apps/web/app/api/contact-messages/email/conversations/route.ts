import { fetchContactConversationsAdmin } from "@/lib/contact-messages/fetch-contact-conversations-admin";
import { mergeUnreadIntoConversations } from "@/lib/contact-messages/merge-conversation-unread";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { resolveCanAccessSharedEmailInbox } from "@/lib/email/resolve-shared-inbox-access-server";
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

  const sharedAccess = await resolveCanAccessSharedEmailInbox({
    admin,
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    userClient: auth.supabase,
  });

  const conversations = await fetchContactConversationsAdmin(admin, {
    restaurantId: auth.restaurantId,
    platform: "email",
    viewerUserId: auth.userId,
    includeSharedEmail: sharedAccess.canAccessShared,
  });

  const reads = await fetchConversationReadsForUser(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    platform: "email",
  });
  const data = mergeUnreadIntoConversations(conversations, reads, "email");
  return Response.json({ data });
}
