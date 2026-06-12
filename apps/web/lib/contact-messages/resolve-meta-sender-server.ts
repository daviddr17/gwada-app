import "server-only";

import { metaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { primaryMessagingId } from "@/lib/supabase/contact-messaging-ids-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveMetaSenderIdForContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    platform: "facebook" | "instagram";
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("contact_messaging_ids")
    .select("platform, external_sender_id, is_primary, sort_order")
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId);

  if (error) {
    console.warn("[meta-sender] fetch", error.message);
    return null;
  }

  return primaryMessagingId(data ?? [], params.platform);
}

export async function resolveContactIdByMetaSender(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: "facebook" | "instagram";
    senderId: string;
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from("contact_messaging_ids")
    .select("contact_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", params.platform)
    .eq("external_sender_id", params.senderId.trim())
    .maybeSingle();

  if (error) {
    console.warn("[meta-sender] lookup", error.message);
    return null;
  }
  return (data as { contact_id: string } | null)?.contact_id ?? null;
}

export function metaPseudoContactIdForSender(
  platform: "facebook" | "instagram",
  senderId: string,
): string {
  return metaPseudoContactId(platform, senderId);
}
