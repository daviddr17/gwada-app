import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export type WahaOutboundFile = {
  fileName: string;
  mimeType: string;
  base64: string;
};

async function wahaPostSend(
  endpoint: "sendImage" | "sendFile",
  params: {
    restaurantId: string;
    chatId: string;
    file: WahaOutboundFile;
    caption?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getWahaServerConfigAdmin();
  if (!config) {
    return { ok: false, error: "waha_not_configured" };
  }

  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const url = `${config.baseUrl}/api/${endpoint}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({
        session,
        chatId: params.chatId,
        caption: params.caption?.trim() || undefined,
        file: {
          mimetype: params.file.mimeType,
          filename: params.file.fileName,
          data: params.file.base64,
        },
      }),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }

  if (!res.ok) {
    let error = `waha_send_${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) error = body.message;
    } catch {
      /* ignore */
    }
    return { ok: false, error };
  }

  return { ok: true };
}

export async function wahaSendImage(params: {
  restaurantId: string;
  chatId: string;
  file: WahaOutboundFile;
  caption?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return wahaPostSend("sendImage", params);
}

export async function wahaSendFile(params: {
  restaurantId: string;
  chatId: string;
  file: WahaOutboundFile;
  caption?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return wahaPostSend("sendFile", params);
}
