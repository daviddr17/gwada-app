import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

type WahaFetchJson<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function wahaJsonGet<T>(
  config: WahaServerConfig,
  path: string,
): Promise<WahaFetchJson<T>> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
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
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
}

export type WahaChatOverviewItem = {
  id: string;
  name?: string | null;
  picture?: string | null;
  lastMessage?: {
    body?: string | null;
    timestamp?: number | null;
    fromMe?: boolean | null;
    from?: string | null;
    to?: string | null;
    hasMedia?: boolean | null;
    type?: string | null;
    media?: {
      url?: string | null;
      mimetype?: string | null;
      filename?: string | null;
    } | null;
    /** 3 = READ, 4 = PLAYED (WAHA ack) */
    ack?: number | null;
    reaction?: {
      text?: string | null;
      messageId?: string | null;
    } | null;
    _data?: Record<string, unknown> | null;
  } | null;
  unreadCount?: number | null;
  _chat?: Record<string, unknown> | { id?: string } | null;
};

export type WahaChatMessage = {
  id: string;
  timestamp?: number;
  from?: string;
  fromMe?: boolean;
  participant?: string;
  body?: string | null;
  hasMedia?: boolean;
  media?: {
    url?: string | null;
    mimetype?: string | null;
    filename?: string | null;
  } | null;
  type?: string;
  ack?: number;
  ackName?: string;
  /** Reaction-Event: Zielnachricht + Emoji (leer = entfernt). */
  reaction?: {
    text?: string | null;
    messageId?: string | null;
  } | null;
  _data?: Record<string, unknown> | null;
};

export function wahaChatIdFromOverview(item: WahaChatOverviewItem): string {
  return item.id ?? item._chat?.id ?? "";
}

export async function wahaGetChatsOverview(params: {
  config: WahaServerConfig;
  restaurantId: string;
  limit?: number;
}): Promise<WahaFetchJson<WahaChatOverviewItem[]>> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const limit = params.limit ?? 80;
  const result = await wahaJsonGet<WahaChatOverviewItem[] | { chats?: WahaChatOverviewItem[] }>(
    params.config,
    `/api/${encodeURIComponent(session)}/chats/overview?limit=${limit}`,
  );
  if (!result.ok) return result;
  const raw = result.data;
  const list = Array.isArray(raw) ? raw : (raw.chats ?? []);
  return { ok: true, data: list };
}

export async function wahaGetChatMessages(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  limit?: number;
  downloadMedia?: boolean;
}): Promise<WahaFetchJson<WahaChatMessage[]>> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const limit = params.limit ?? 80;
  const downloadMedia = params.downloadMedia === true;
  const chatId = encodeURIComponent(params.chatId);
  const result = await wahaJsonGet<WahaChatMessage[] | { messages?: WahaChatMessage[] }>(
    params.config,
    `/api/${encodeURIComponent(session)}/chats/${chatId}/messages?limit=${limit}&downloadMedia=${downloadMedia}`,
  );
  if (!result.ok) return result;
  const raw = result.data;
  const list = Array.isArray(raw) ? raw : (raw.messages ?? []);
  return { ok: true, data: list };
}

/** Ungelesen laut Overview; 0 wenn letzte eingehende Nachricht in WhatsApp bereits gelesen (ack ≥ 3). */
export function wahaEffectiveUnreadCount(
  chat: WahaChatOverviewItem,
): number {
  const raw = chat.unreadCount ?? 0;
  const last = chat.lastMessage;
  if (
    last &&
    !last.fromMe &&
    typeof last.ack === "number" &&
    last.ack >= 3
  ) {
    return 0;
  }
  return Math.max(0, raw);
}

/** Overview sort: chats without WAHA timestamp must not appear as „just now“. */
export const WAHA_MISSING_TIMESTAMP_ISO = "1970-01-01T00:00:00.000Z";

export function wahaTimestampToIso(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts)) {
    return WAHA_MISSING_TIMESTAMP_ISO;
  }
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) {
    return WAHA_MISSING_TIMESTAMP_ISO;
  }
  return d.toISOString();
}

/** Profilbild-URL für einen Chat (WAHA cached ~24h). */
export async function wahaGetChatPictureUrl(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  refresh?: boolean;
}): Promise<string | null> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const chatSeg = encodeURIComponent(params.chatId.trim());
  const refreshQuery = params.refresh ? "?refresh=True" : "";
  const result = await wahaJsonGet<{ url?: string | null }>(
    params.config,
    `/api/${encodeURIComponent(session)}/chats/${chatSeg}/picture${refreshQuery}`,
  );
  if (!result.ok) return null;
  const url = result.data?.url?.trim();
  return url || null;
}
