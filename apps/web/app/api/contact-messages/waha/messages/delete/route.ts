import { deleteWahaMessageServer } from "@/lib/contact-messages/waha-delete-message-server";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    chatId?: string;
    messageId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const chatId = body.chatId?.trim() ?? "";
  const messageId = body.messageId?.trim() ?? "";

  if (!restaurantId || !chatId || !messageId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();

  const result = await deleteWahaMessageServer({
    restaurantId: auth.restaurantId,
    chatId,
    messageId,
    admin,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
