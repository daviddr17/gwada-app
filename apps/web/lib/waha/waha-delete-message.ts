import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

type WahaDeleteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function wahaDeleteMessage(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  messageId: string;
}): Promise<WahaDeleteResult> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatId = encodeURIComponent(params.chatId.trim());
  const messageId = encodeURIComponent(params.messageId.trim());
  const url = `${params.config.baseUrl}/api/${encodeURIComponent(session)}/chats/${chatId}/messages/${messageId}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "X-Api-Key": params.config.apiKey,
      },
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
