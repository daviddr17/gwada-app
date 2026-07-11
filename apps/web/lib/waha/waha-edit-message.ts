import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

type WahaEditResult = { ok: true } | { ok: false; error: string };

export async function wahaEditMessage(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  messageId: string;
  text: string;
}): Promise<WahaEditResult> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatId = encodeURIComponent(params.chatId.trim());
  const messageId = encodeURIComponent(params.messageId.trim());
  const url = `${params.config.baseUrl}/api/${encodeURIComponent(session)}/chats/${chatId}/messages/${messageId}`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": params.config.apiKey,
      },
      body: JSON.stringify({ text: params.text.trim(), linkPreview: false }),
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
