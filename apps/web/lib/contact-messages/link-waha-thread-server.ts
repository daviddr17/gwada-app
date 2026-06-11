import "server-only";

import {
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import {
  fetchWahaThreadMessages,
} from "@/lib/contact-messages/waha-inbox-service";
import { whatsappMirrorBodyFromContactRow } from "@/lib/contact-messages/whatsapp-mirror-preview";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function linkWahaThreadToContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    wahaContactId: string;
  },
): Promise<{ ok: boolean; imported: number; error: string | null }> {
  const chatId = wahaChatIdFromPseudoContactId(params.wahaContactId);
  if (!chatId) {
    return { ok: false, imported: 0, error: "invalid_waha_contact" };
  }

  const { data: contact } = await admin
    .from("contacts")
    .select("id")
    .eq("id", params.contactId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!contact) {
    return { ok: false, imported: 0, error: "contact_not_found" };
  }

  const { data: messages, error: fetchErr } = await fetchWahaThreadMessages(
    admin,
    {
      restaurantId: params.restaurantId,
      contactId: params.wahaContactId,
      chatIdOverride: chatId,
    },
  );

  if (fetchErr) {
    return { ok: false, imported: 0, error: fetchErr };
  }

  if (messages.length === 0) {
    return { ok: true, imported: 0, error: null };
  }

  const externalIds = messages
    .map((m) => m.id)
    .filter((id) => id.startsWith("waha:"));

  const { data: existing } = await admin
    .from("contact_messages")
    .select("external_source_id")
    .eq("restaurant_id", params.restaurantId)
    .in("external_source_id", externalIds);

  const known = new Set(
    (existing ?? []).map(
      (r) => (r as { external_source_id: string }).external_source_id,
    ),
  );

  const rows = messages
    .filter((m) => m.id.startsWith("waha:") && !known.has(m.id))
    .map((m) => ({
      restaurant_id: params.restaurantId,
      contact_id: params.contactId,
      platform: "whatsapp" as const,
      direction: m.direction,
      body: whatsappMirrorBodyFromContactRow(m),
      reservation_id: m.reservation_id,
      sent_by: null,
      delivery_status: m.delivery_status,
      created_at: m.created_at,
      external_source_id: m.id,
    }))
    .filter((m) => m.body.trim().length > 0);

  if (rows.length === 0) {
    return { ok: true, imported: 0, error: null };
  }

  const { error: insErr } = await admin.from("contact_messages").insert(rows);
  if (insErr) {
    return { ok: false, imported: 0, error: insErr.message };
  }

  return { ok: true, imported: rows.length, error: null };
}
