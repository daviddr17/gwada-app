import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import {
  markConversationReadDbServer,
  syncConversationReadExternalServer,
} from "@/lib/contact-messages/mark-conversation-read-server";
import {
  markUnifiedInboxConversationReadDbServer,
  syncUnifiedInboxConversationReadExternalServer,
} from "@/lib/contact-messages/mark-unified-conversation-read-server";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { conversationChannelForRead } from "@/lib/contact-messages/unified-inbox-merge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isContactMessagePlatform,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import { after } from "next/server";

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
  if (!conversationKey) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  if (isLinkedContactId(conversationKey)) {
    const result = await markUnifiedInboxConversationReadDbServer(admin, {
      restaurantId: auth.restaurantId,
      userId: auth.userId,
      conversationKey,
    });
    if (result.error) {
      return Response.json({ error: result.error }, { status: 502 });
    }
    after(() =>
      syncUnifiedInboxConversationReadExternalServer(admin, result.marks),
    );
    return Response.json({ ok: true });
  }

  const readPlatform =
    platform && isContactMessagePlatform(platform)
      ? platform
      : conversationChannelForRead(conversationKey);
  if (!isContactMessagePlatform(readPlatform)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const markParams = {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    conversationKey,
    platform: readPlatform as ContactMessagePlatform,
  };
  const result = await markConversationReadDbServer(admin, markParams);

  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  after(() => syncConversationReadExternalServer(admin, markParams));
  return Response.json({ ok: true });
}
