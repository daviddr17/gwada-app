import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import {
  wahaStartRecording,
  wahaStartTyping,
  wahaStopRecording,
  wahaStopTyping,
} from "@/lib/waha/waha-presence";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    chatId?: string;
    action?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const chatId = body.chatId?.trim() ?? "";
  const action = body.action?.trim();

  if (
    !chatId ||
    (action !== "start" &&
      action !== "stop" &&
      action !== "recording" &&
      action !== "recording_stop")
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const config = await getWahaServerConfigForRestaurantAdmin(
    auth.restaurantId,
  );
  if (!config) {
    return Response.json({ error: "waha_not_configured" }, { status: 503 });
  }

  const base = { config, restaurantId: auth.restaurantId, chatId };
  const result =
    action === "start"
      ? await wahaStartTyping(base)
      : action === "recording"
        ? await wahaStartRecording(base)
        : action === "recording_stop"
          ? await wahaStopRecording(base)
          : await wahaStopTyping(base);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
