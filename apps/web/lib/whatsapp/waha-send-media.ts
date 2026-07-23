import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export type WahaOutboundFile = {
  fileName: string;
  mimeType: string;
  base64: string;
};

type SendEndpoint = "sendImage" | "sendFile" | "sendVoice" | "sendVideo";

async function wahaPostSend(
  endpoint: SendEndpoint,
  params: {
    restaurantId: string;
    chatId: string;
    file: WahaOutboundFile;
    caption?: string;
    convert?: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getWahaServerConfigForRestaurantAdmin(params.restaurantId);
  if (!config) {
    return { ok: false, error: "waha_not_configured" };
  }

  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const url = `${config.baseUrl}/api/${endpoint}`;

  const body: Record<string, unknown> = {
    session,
    chatId: params.chatId,
    file: {
      mimetype: params.file.mimeType,
      filename: params.file.fileName,
      data: params.file.base64,
    },
  };

  if (params.caption?.trim()) {
    body.caption = params.caption.trim();
  }
  if (params.convert != null) {
    body.convert = params.convert;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }

  if (!res.ok) {
    let error = `waha_send_${res.status}`;
    try {
      const parsed = (await res.json()) as { message?: string };
      if (parsed.message) error = parsed.message;
    } catch {
      /* ignore */
    }
    return { ok: false, error: msgError(endpoint, error) };
  }

  return { ok: true };
}

function msgError(endpoint: SendEndpoint, error: string): string {
  return error.startsWith("waha_") ? error : `${endpoint}:${error}`;
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

export async function wahaSendVoice(params: {
  restaurantId: string;
  chatId: string;
  file: WahaOutboundFile;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return wahaPostSend("sendVoice", {
    ...params,
    convert: true,
  });
}

export async function wahaSendVideo(params: {
  restaurantId: string;
  chatId: string;
  file: WahaOutboundFile;
  caption?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return wahaPostSend("sendVideo", {
    ...params,
    convert: true,
  });
}
