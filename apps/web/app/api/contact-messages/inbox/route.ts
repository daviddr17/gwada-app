import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { loadInboxConversationsServer } from "@/lib/contact-messages/load-inbox-conversations-server";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const INBOX_PLATFORMS = new Set<ContactMessagePlatform>([
  "gwada",
  "whatsapp",
  "email",
  "facebook",
  "instagram",
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const platformRaw = url.searchParams.get("platform")?.trim();
  let platform: ContactMessagePlatform | undefined;
  if (platformRaw && platformRaw !== "all") {
    if (!INBOX_PLATFORMS.has(platformRaw as ContactMessagePlatform)) {
      return Response.json({ error: "invalid_platform" }, { status: 400 });
    }
    platform = platformRaw as ContactMessagePlatform;
  }

  const { conversations, channels } = await loadInboxConversationsServer(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    supabase: auth.supabase,
    platform,
  });

  return Response.json({
    data: {
      conversations,
      channels,
    },
  });
}
