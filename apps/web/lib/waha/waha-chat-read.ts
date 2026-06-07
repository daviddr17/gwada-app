import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

type WahaFetchResult =
  | { ok: true }
  | { ok: false; error: string };

async function wahaJsonPost(
  config: WahaServerConfig,
  path: string,
  body: Record<string, unknown> = {},
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

/** Alle ungelesenen Nachrichten im Chat als gelesen melden (WAHA → WhatsApp). */
export async function wahaMarkChatAsRead(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
}): Promise<WahaFetchResult> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatId = encodeURIComponent(params.chatId.trim());
  return wahaJsonPost(
    params.config,
    `/api/${encodeURIComponent(session)}/chats/${chatId}/messages/read`,
    {},
  );
}

/** Chat in WAHA als ungelesen markieren. */
export async function wahaMarkChatAsUnread(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
}): Promise<WahaFetchResult> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatId = encodeURIComponent(params.chatId.trim());
  return wahaJsonPost(
    params.config,
    `/api/${encodeURIComponent(session)}/chats/${chatId}/unread`,
    {},
  );
}
