import { resolveWahaChatPhone } from "@/lib/contact-messages/resolve-waha-chat-phone";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const chatId = searchParams.get("chatId")?.trim() ?? "";

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!chatId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await resolveWahaChatPhone({
    restaurantId: auth.restaurantId,
    chatId,
  });

  return Response.json({
    phoneForParse: result.phoneForParse,
    phoneChatId: result.phoneChatId,
    isLidChat: result.isLidChat,
    lidUnresolved: result.lidUnresolved,
    error: result.error,
  });
}
