import "server-only";

import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { WahaServerConfig } from "@/lib/waha/waha-config";

export type WahaChannel = {
  id: string;
  name: string;
  description?: string | null;
  invite?: string | null;
  picture?: string | null;
  role?: string | null;
};

export type WahaCreateChannelInput = {
  name: string;
  description?: string | null;
  picture?: {
    mimetype: string;
    filename: string;
    url: string;
  } | null;
};

type WahaMessage = {
  id?: string;
  timestamp?: number;
  body?: string;
  from?: string;
  hasMedia?: boolean;
  media?: { url?: string; mimetype?: string };
  ack?: number;
};

async function wahaJson<T>(
  config: WahaServerConfig,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" };
  }
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
    return { ok: true, data: {} as T };
  }
  return { ok: true, data: (await res.json()) as T };
}

export async function listWahaChannelsForRestaurant(
  restaurantId: string,
  opts?: { role?: "OWNER" | "ADMIN" },
): Promise<{ channels: WahaChannel[] } | { error: string }> {
  const config = await getWahaServerConfigAdmin();
  if (!config) return { error: "waha_not_configured" };
  const session = wahaSessionNameForRestaurant(restaurantId);
  const qs = opts?.role ? `?role=${encodeURIComponent(opts.role)}` : "";
  const result = await wahaJson<WahaChannel[]>(
    config,
    `/api/${encodeURIComponent(session)}/channels${qs}`,
  );
  if (!result.ok) return { error: result.error };
  return { channels: result.data ?? [] };
}

/** WhatsApp-Newsletter-Kanal anlegen (WAHA Plus, @newsletter). */
export async function createWahaChannelForRestaurant(
  restaurantId: string,
  input: WahaCreateChannelInput,
): Promise<{ channel: WahaChannel } | { error: string }> {
  const name = input.name.trim();
  if (!name) return { error: "invalid_channel_name" };

  const config = await getWahaServerConfigAdmin();
  if (!config) return { error: "waha_not_configured" };

  const session = wahaSessionNameForRestaurant(restaurantId);
  const body: Record<string, unknown> = { name };
  const description = input.description?.trim();
  if (description) body.description = description;
  if (input.picture?.url?.trim()) {
    body.picture = {
      mimetype: input.picture.mimetype,
      filename: input.picture.filename,
      url: input.picture.url.trim(),
    };
  }

  const result = await wahaJson<WahaChannel>(
    config,
    `/api/${encodeURIComponent(session)}/channels`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  if (!result.ok) return { error: result.error };
  if (!result.data?.id?.trim()) return { error: "waha_channel_create_failed" };
  return { channel: result.data };
}

export async function fetchWahaChannelMessages(
  restaurantId: string,
  channelId: string,
  opts?: { limit?: number },
): Promise<{ messages: WahaMessage[] } | { error: string }> {
  const config = await getWahaServerConfigAdmin();
  if (!config) return { error: "waha_not_configured" };
  const session = wahaSessionNameForRestaurant(restaurantId);
  const limit = opts?.limit ?? 50;
  const encoded = encodeURIComponent(channelId);
  const result = await wahaJson<WahaMessage[]>(
    config,
    `/api/${encodeURIComponent(session)}/chats/${encoded}/messages?downloadMedia=false&limit=${limit}`,
  );
  if (!result.ok) return { error: result.error };
  return { messages: result.data ?? [] };
}

export type { WahaMessage };
