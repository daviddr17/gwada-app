import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaResolveMessageMediaBlob } from "@/lib/waha/waha-fetch-media";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string, inline: boolean): string {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(fileName);
  const kind = inline ? "inline" : "attachment";
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

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

  const inline =
    mime.startsWith("image/") ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/");

  return new Response(media.blob, {
    headers: {
      "Content-Type": media.mime,
      "Content-Disposition": contentDisposition(media.fileName, inline),
      "X-Gwada-Filename": encodeURIComponent(media.fileName),
      // Kein Browser-Cache: alte HTML-Fehlerantworten sonst Stunden speichern.
      "Cache-Control": "private, no-store",
    },
  });
}
