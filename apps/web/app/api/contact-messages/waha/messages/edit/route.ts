import { editWahaMessageServer } from "@/lib/contact-messages/waha-edit-message-server";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    chatId?: string;
    messageId?: string;
    text?: string;
    contactId?: string;
    previousText?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const chatId = body.chatId?.trim() ?? "";
  const messageId = body.messageId?.trim() ?? "";
  const text = body.text?.trim() ?? "";
  const contactId = body.contactId?.trim() ?? "";
  const previousText = body.previousText?.trim() ?? "";

  if (!restaurantId || !chatId || !messageId || !text) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();

  const result = await editWahaMessageServer({
    restaurantId: auth.restaurantId,
    chatId,
    messageId,
    text,
    contactId: contactId || null,
    previousText: previousText || null,
    admin,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
