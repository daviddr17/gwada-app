import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchMessagesUnreadSummary } from "@/lib/contact-messages/unread-summary-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { isMetaInboxConnected } from "@/lib/contact-messages/meta-inbox-auth-server";

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

  const [wahaConfig, imapCreds, facebookConnected, instagramConnected] =
    await Promise.all([
      getWahaServerConfigForRestaurantAdmin(auth.restaurantId),
      resolveRestaurantImapCredentials(admin, auth.restaurantId),
      isMetaInboxConnected(admin, auth.restaurantId, "facebook"),
      isMetaInboxConnected(admin, auth.restaurantId, "instagram"),
    ]);

  const scope = new URL(req.url).searchParams.get("scope");
  const includeInboxConversations = scope !== "dashboard";

  const summary = await fetchMessagesUnreadSummary(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    whatsappConnected: Boolean(wahaConfig),
    emailConnected: Boolean(imapCreds),
    facebookConnected,
    instagramConnected,
    includeInboxConversations,
  });

  return Response.json({ data: summary });
}
