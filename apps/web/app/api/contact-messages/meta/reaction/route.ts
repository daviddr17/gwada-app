import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { setMetaMessageReactionServer } from "@/lib/contact-messages/meta-reaction-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    platform?: string;
    messageId?: string;
    reaction?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const platform = body.platform;
  const messageId = body.messageId?.trim() ?? "";
  const reaction = body.reaction ?? "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !messageId ||
    (platform !== "facebook" && platform !== "instagram")
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await setMetaMessageReactionServer(admin, {
    restaurantId,
    platform,
    messageId,
    reaction,
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
