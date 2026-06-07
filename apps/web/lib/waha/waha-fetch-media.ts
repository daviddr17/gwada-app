import "server-only";

import { parseWahaMessageMedia } from "@/lib/contact-messages/waha-message-media";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaGetChatMessages, type WahaChatMessage } from "@/lib/waha/waha-inbox";

async function wahaFetchBinary(
  config: WahaServerConfig,
  mediaUrl: string,
): Promise<{ blob: Blob; mime: string } | null> {
  const path = mediaUrl.startsWith("http")
    ? mediaUrl
    : `${config.baseUrl}${mediaUrl.startsWith("/") ? mediaUrl : `/${mediaUrl}`}`;

  try {
    const res = await fetch(path, {
      headers: { "X-Api-Key": config.apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const mime =
      res.headers.get("content-type")?.split(";")[0]?.trim() ??
      "application/octet-stream";
    const blob = await res.blob();
    return { blob, mime };
  } catch {
    return null;
  }
}

export async function wahaResolveMessageMediaBlob(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  messageId: string;
}): Promise<{ blob: Blob; mime: string; fileName: string } | null> {
  const result = await wahaGetChatMessages({
    config: params.config,
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    limit: 120,
    downloadMedia: true,
  });
  if (!result.ok) return null;

  const msg = result.data.find((m: WahaChatMessage) => m.id === params.messageId);
  if (!msg) return null;

  const parsed = parseWahaMessageMedia(msg);
  if (!parsed?.url) return null;

  const fetched = await wahaFetchBinary(params.config, parsed.url);
  if (!fetched) return null;

  return {
    blob: fetched.blob,
    mime: fetched.mime || parsed.mimetype,
    fileName: parsed.filename,
  };
}
