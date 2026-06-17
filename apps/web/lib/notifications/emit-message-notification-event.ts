import "server-only";

import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { SupabaseClient } from "@supabase/supabase-js";

async function contactNameForNotification(
  admin: SupabaseClient,
  contactId: string,
): Promise<string> {
  const { data } = await admin
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", contactId)
    .maybeSingle();

  if (!data) return "Kontakt";

  const row = data as { first_name?: string | null; last_name?: string | null };
  const name = [row.first_name, row.last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ");

  return name || "Kontakt";
}

/** Push-Event für Nachrichten (wenn kein contact_messages-Trigger greift, z. B. unverknüpfter WAHA-Chat). */
export async function emitMessageNotificationEventIfNew(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    referenceId: string;
    payload: Record<string, unknown>;
  },
): Promise<{ emitted: boolean; eventId: string | null }> {
  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("module", "messages")
    .eq("reference_id", params.referenceId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (existing) {
    const id = (existing as { id: string }).id;
    return { emitted: false, eventId: id };
  }

  const { data, error } = await admin
    .from("notification_events")
    .insert({
      restaurant_id: params.restaurantId,
      module: "messages",
      reference_id: params.referenceId,
      payload: params.payload,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[notification] emit messages event", error.message);
    return { emitted: false, eventId: null };
  }

  const id = (data as { id: string }).id;
  return { emitted: true, eventId: id };
}

/** Nach INSERT in contact_messages — gleiche reference_id wie DB-Trigger (message id). */
export async function emitMessageNotificationEventForInboundContactMessage(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    messageId: string;
    contactId: string;
    platform: ContactMessagePlatform;
    body: string;
    createdAt?: string;
  },
): Promise<{ emitted: boolean; eventId: string | null }> {
  const contactName = await contactNameForNotification(admin, params.contactId);
  const preview = params.body.trim().slice(0, 120);

  return emitMessageNotificationEventIfNew(admin, {
    restaurantId: params.restaurantId,
    referenceId: params.messageId,
    payload: {
      contactId: params.contactId,
      contactName,
      preview,
      platform: params.platform,
      messageCreatedAt: params.createdAt ?? new Date().toISOString(),
    },
  });
}
