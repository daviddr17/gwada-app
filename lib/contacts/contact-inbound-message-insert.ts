import "server-only";

import type { ContactMessageDirection } from "@/lib/constants/contact-message-platforms";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertContactMessageIfNew(
  admin: SupabaseClient,
  row: {
    restaurantId: string;
    contactId: string;
    platform: ContactMessagePlatform;
    direction: ContactMessageDirection;
    body: string;
    externalSourceId: string;
    createdAt?: string;
    reservationId?: string | null;
    deliveryStatus?: string;
  },
): Promise<boolean> {
  const { data: existing } = await admin
    .from("contact_messages")
    .select("id")
    .eq("restaurant_id", row.restaurantId)
    .eq("external_source_id", row.externalSourceId)
    .maybeSingle();

  if (existing) return false;

  const { error } = await admin.from("contact_messages").insert({
    restaurant_id: row.restaurantId,
    contact_id: row.contactId,
    platform: row.platform,
    direction: row.direction,
    body: row.body,
    reservation_id: row.reservationId ?? null,
    sent_by: null,
    delivery_status: row.deliveryStatus ?? "delivered",
    external_source_id: row.externalSourceId,
    ...(row.createdAt ? { created_at: row.createdAt } : {}),
  });

  if (error) {
    console.warn("[contact-inbox] insert", error.message);
    return false;
  }
  return true;
}
