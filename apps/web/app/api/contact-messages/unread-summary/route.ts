import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchMessagesUnreadSummary } from "@/lib/contact-messages/unread-summary-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";

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

  const [wahaConfig, imapCreds] = await Promise.all([
    getWahaServerConfigAdmin(),
    resolveRestaurantImapCredentials(admin, auth.restaurantId),
  ]);

  const scope = new URL(req.url).searchParams.get("scope");
  const includeInboxConversations = scope !== "dashboard";

  const summary = await fetchMessagesUnreadSummary(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    whatsappConnected: Boolean(wahaConfig),
    emailConnected: Boolean(imapCreds),
    includeInboxConversations,
  });

  return Response.json({ data: summary });
}
