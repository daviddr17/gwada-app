import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaResolveMessageMediaBlob } from "@/lib/waha/waha-fetch-media";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const chatId = url.searchParams.get("chatId")?.trim() ?? "";
  const messageId = url.searchParams.get("messageId")?.trim() ?? "";

  if (!restaurantId || !chatId || !messageId) {
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

  const media = await wahaResolveMessageMediaBlob({
    config,
    restaurantId: auth.restaurantId,
    chatId,
    messageId,
  });
  if (!media) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const disposition =
    media.mime.startsWith("image/") ||
    media.mime.startsWith("audio/") ||
    media.mime.startsWith("video/")
      ? "inline"
      : "attachment";

  return new Response(media.blob, {
    headers: {
      "Content-Type": media.mime,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(media.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
