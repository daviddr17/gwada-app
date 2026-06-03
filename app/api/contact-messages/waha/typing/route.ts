import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaStartTyping, wahaStopTyping } from "@/lib/waha/waha-presence";

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

  if (!chatId || (action !== "start" && action !== "stop")) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const config = await getWahaServerConfigAdmin();
  if (!config) {
    return Response.json({ error: "waha_not_configured" }, { status: 503 });
  }

  const result =
    action === "start"
      ? await wahaStartTyping({ config, restaurantId, chatId })
      : await wahaStopTyping({ config, restaurantId, chatId });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
