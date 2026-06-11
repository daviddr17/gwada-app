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
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "X-Api-Key": config.apiKey },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" };
  }
  if (!res.ok) {
    return { ok: false, error: `waha_${res.status}` };
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
