import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import {
  markConversationReadServer,
} from "@/lib/contact-messages/mark-conversation-read-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isContactMessagePlatform,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    conversationKey?: string;
    platform?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(
    body.restaurantId ?? null,
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const conversationKey = body.conversationKey?.trim() ?? "";
  const platform = body.platform?.trim() ?? "";
  if (!conversationKey || !isContactMessagePlatform(platform)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await markConversationReadServer(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    conversationKey,
    platform: platform as ContactMessagePlatform,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
