import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

type WahaFetchResult =
  | { ok: true }
  | { ok: false; error: string };

async function wahaJsonPost(
  config: WahaServerConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<WahaFetchResult> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      let error = `waha_${res.status}`;
      try {
        const parsed = (await res.json()) as { message?: string; error?: string };
        error = parsed.message ?? parsed.error ?? error;
      } catch {
        /* ignore */
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
}

export type WahaChatPresence = "typing" | "paused" | "recording";

export async function wahaSetChatPresence(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  presence: WahaChatPresence;
}): Promise<WahaFetchResult> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatId = params.chatId.trim();
  return wahaJsonPost(params.config, `/api/${encodeURIComponent(session)}/presence`, {
    chatId,
    presence: params.presence,
  });
}

export async function wahaStartTyping(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
}): Promise<WahaFetchResult> {
  return wahaSetChatPresence({ ...params, presence: "typing" });
}

export async function wahaStopTyping(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
}): Promise<WahaFetchResult> {
  return wahaSetChatPresence({ ...params, presence: "paused" });
}
