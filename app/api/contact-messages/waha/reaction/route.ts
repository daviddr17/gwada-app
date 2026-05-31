import { setWahaMessageReactionServer } from "@/lib/contact-messages/waha-reaction-server";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    messageId?: string;
    reaction?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const messageId = body.messageId?.trim() ?? "";
  const reaction = typeof body.reaction === "string" ? body.reaction : "";

  if (!isUuidRestaurantId(restaurantId) || !messageId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await setWahaMessageReactionServer({
    restaurantId: auth.restaurantId,
    messageId,
    reaction,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
