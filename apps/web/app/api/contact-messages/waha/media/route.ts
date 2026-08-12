import { attachmentDownloadHeaders } from "@/lib/contact-messages/attachment-download-headers";
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

  const mime = media.mime.toLowerCase();
  if (
    mime.startsWith("text/html") ||
    mime.startsWith("application/json") ||
    mime.startsWith("text/plain")
  ) {
    return Response.json({ error: "invalid_media" }, { status: 502 });
  }

  return new Response(media.blob, {
    headers: attachmentDownloadHeaders({
      fileName: media.fileName,
      mimeType: media.mime,
    }),
  });
}
