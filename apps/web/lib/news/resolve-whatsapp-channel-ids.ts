import "server-only";

import { listWahaChannelsForRestaurant } from "@/lib/waha/waha-channels";

export function normalizeWhatsappChannelIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** WhatsApp-Kanäle für News (und Event-Ankündigungen) — eine Quelle: restaurant_news_settings. */
export async function resolveNewsWhatsappChannelIds(
  restaurantId: string,
  sb: import("@supabase/supabase-js").SupabaseClient,
  override?: string | null,
): Promise<string[]> {
  if (override?.includes("@newsletter")) return [override];
  const { data } = await sb
    .from("restaurant_news_settings")
    .select("whatsapp_channel_ids, whatsapp_channel_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const fromArray = normalizeWhatsappChannelIds(data?.whatsapp_channel_ids);
  if (fromArray.length > 0) return fromArray;

  const legacy = (data?.whatsapp_channel_id as string | null)?.trim();
  if (legacy) return [legacy];

  const list = await listWahaChannelsForRestaurant(restaurantId, { role: "OWNER" });
  if ("error" in list) return [];
  return list.channels.map((channel) => channel.id).filter(Boolean);
}
