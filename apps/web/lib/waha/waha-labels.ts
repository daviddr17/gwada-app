import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export type WahaBusinessLabel = {
  id: string;
  name: string;
  color?: number;
  colorHex?: string;
  type?: number;
  isActive?: boolean;
};

type WahaJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function wahaJson<T>(
  config: WahaServerConfig,
  path: string,
  init?: RequestInit,
): Promise<WahaJsonResult<T>> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      let error = `waha_${res.status}`;
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        error = body.message ?? body.error ?? error;
      } catch {
        /* ignore */
      }
      return { ok: false, error };
    }
    if (res.status === 204) {
      return { ok: true, data: undefined as T };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch_failed",
    };
  }
}

/** WhatsApp Business Labels for the restaurant session (NOWEB+). */
export async function wahaListLabels(params: {
  config: WahaServerConfig;
  restaurantId: string;
}): Promise<WahaJsonResult<WahaBusinessLabel[]>> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const result = await wahaJson<WahaBusinessLabel[]>(
    params.config,
    `/api/${encodeURIComponent(session)}/labels`,
  );
  if (!result.ok) return result;
  const list = Array.isArray(result.data) ? result.data : [];
  return { ok: true, data: list };
}

export async function wahaCreateLabel(params: {
  config: WahaServerConfig;
  restaurantId: string;
  name: string;
  colorHex?: string;
}): Promise<WahaJsonResult<WahaBusinessLabel>> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  return wahaJson<WahaBusinessLabel>(
    params.config,
    `/api/${encodeURIComponent(session)}/labels`,
    {
      method: "POST",
      body: JSON.stringify({
        name: params.name.trim(),
        ...(params.colorHex ? { colorHex: params.colorHex } : {}),
      }),
    },
  );
}

export async function wahaGetChatLabels(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
}): Promise<WahaJsonResult<WahaBusinessLabel[]>> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatId = encodeURIComponent(params.chatId.trim());
  const result = await wahaJson<WahaBusinessLabel[]>(
    params.config,
    `/api/${encodeURIComponent(session)}/labels/chats/${chatId}/`,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: Array.isArray(result.data) ? result.data : [],
  };
}

/**
 * Replace labels on a chat (WAHA PUT). Pass full desired label id list.
 * Built-in WhatsApp lists cannot be assigned via API — only custom labels.
 */
export async function wahaPutChatLabels(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  labelIds: string[];
}): Promise<WahaJsonResult<unknown>> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatId = encodeURIComponent(params.chatId.trim());
  return wahaJson(
    params.config,
    `/api/${encodeURIComponent(session)}/labels/chats/${chatId}/`,
    {
      method: "PUT",
      body: JSON.stringify({
        labels: params.labelIds.map((id) => ({ id })),
      }),
    },
  );
}
