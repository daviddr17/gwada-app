import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import {
  clearConversationFollowUp,
  upsertConversationFollowUp,
} from "@/lib/contact-messages/conversation-follow-ups-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    conversationKey?: string;
    contactDisplayName?: string | null;
    reason?: string | null;
    remindAt?: string | null;
    staffId?: string | null;
    notifyWhatsapp?: boolean;
    notifyEmail?: boolean;
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
  if (!conversationKey) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await upsertConversationFollowUp(admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    conversationKey,
    contactDisplayName: body.contactDisplayName,
    reason: body.reason,
    remindAt: body.remindAt,
    staffId: body.staffId,
    notifyWhatsapp: body.notifyWhatsapp === true,
    notifyEmail: body.notifyEmail === true,
  });

  if (result.error) {
    const status =
      result.error === "invalid_request" ||
      result.error === "invalid_remind_at" ||
      result.error === "invalid_staff" ||
      result.error === "reason_too_long"
        ? 400
        : 502;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true, data: result.data });
}

export async function DELETE(req: Request) {
  let body: {
    restaurantId?: string;
    conversationKey?: string;
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
  if (!conversationKey) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await clearConversationFollowUp(admin, {
    restaurantId: auth.restaurantId,
    conversationKey,
  });
  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
