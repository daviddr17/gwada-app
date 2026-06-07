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
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
}

export type WahaLidMapping = {
  lid: string;
  pn: string | null;
};

export type WahaContactInfo = {
  id?: string;
  number?: string | null;
  name?: string | null;
  pushname?: string | null;
  shortName?: string | null;
};

/** WhatsApp Linked ID — kein Telefon, nur interne Kennung (z. B. `31142858252478@lid`). */
export function isWahaLidChatId(chatId: string): boolean {
  const id = chatId.trim().toLowerCase();
  return id.endsWith("@lid") || id.includes("@lid");
}

/** Klassische Telefon-Chat-ID (`491701234567@c.us` oder `@s.whatsapp.net`). */
export function isWahaPhoneChatId(chatId: string): boolean {
  const id = chatId.trim().toLowerCase();
  if (isWahaLidChatId(id)) return false;
  return (
    id.endsWith("@c.us") ||
    id.endsWith("@s.whatsapp.net") ||
    (!id.includes("@") && /^\d{8,}$/.test(id))
  );
}

function lidPathSegment(lidChatId: string): string {
  const raw = lidChatId.trim();
  if (raw.includes("@")) return encodeURIComponent(raw);
  return encodeURIComponent(`${raw.replace(/\D/g, "")}@lid`);
}

/** WAHA: LID → Telefon-Chat-ID (`pn`, z. B. `49123456789@c.us`). */
export async function wahaResolveLidToPhoneChatId(params: {
  config: WahaServerConfig;
  restaurantId: string;
  lidChatId: string;
}): Promise<{ pn: string | null; error: string | null }> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const result = await wahaJsonGet<WahaLidMapping>(
    params.config,
    `/api/${encodeURIComponent(session)}/lids/${lidPathSegment(params.lidChatId)}`,
  );
  if (!result.ok) return { pn: null, error: result.error };
  return { pn: result.data.pn?.trim() || null, error: null };
}

/** Alle bekannten Kontakte der Session (Dashboard nutzt dieselbe Quelle). */
export async function wahaGetAllContacts(params: {
  config: WahaServerConfig;
  restaurantId: string;
  limit?: number;
}): Promise<{ data: WahaContactInfo[]; error: string | null }> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const limit = params.limit ?? 500;
  const result = await wahaJsonGet<WahaContactInfo[]>(
    params.config,
    `/api/contacts/all?session=${encodeURIComponent(session)}&limit=${limit}`,
  );
  if (!result.ok) return { data: [], error: result.error };
  return { data: Array.isArray(result.data) ? result.data : [], error: null };
}

/** Alle bekannten LID → Telefon-Mappings der Session. */
export async function wahaGetAllLidMappings(params: {
  config: WahaServerConfig;
  restaurantId: string;
  limit?: number;
}): Promise<{ data: WahaLidMapping[]; error: string | null }> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const limit = params.limit ?? 500;
  const result = await wahaJsonGet<WahaLidMapping[]>(
    params.config,
    `/api/${encodeURIComponent(session)}/lids?limit=${limit}`,
  );
  if (!result.ok) return { data: [], error: result.error };
  return { data: Array.isArray(result.data) ? result.data : [], error: null };
}

/** WAHA Kontakt-Endpoint — `number` kann bei @lid-Chats gesetzt sein. */
export async function wahaGetContactByChatId(params: {
  config: WahaServerConfig;
  restaurantId: string;
  contactId: string;
}): Promise<{ data: WahaContactInfo | null; error: string | null }> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const id = encodeURIComponent(params.contactId.trim());
  const result = await wahaJsonGet<WahaContactInfo>(
    params.config,
    `/api/contacts?contactId=${id}&session=${encodeURIComponent(session)}`,
  );
  if (!result.ok) return { data: null, error: result.error };
  return { data: result.data, error: null };
}
