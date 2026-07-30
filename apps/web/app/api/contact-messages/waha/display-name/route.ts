import { resolveWahaChatDisplayName } from "@/lib/contact-messages/waha-chat-display-name";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";

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

  const config = await getWahaServerConfigForRestaurantAdmin(
    auth.restaurantId,
  );
  if (!config) {
    return Response.json({ error: "waha_not_configured" }, { status: 503 });
  }

  const displayName = await resolveWahaChatDisplayName({
    config,
    restaurantId: auth.restaurantId,
    chatId,
  });

  return Response.json({ displayName });
}
