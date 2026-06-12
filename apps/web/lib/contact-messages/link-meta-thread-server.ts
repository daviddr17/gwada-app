import "server-only";

import { fetchMetaThreadMessages } from "@/lib/contact-messages/meta-inbox-service";
import { parseMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function upsertContactMessagingId(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    platform: "facebook" | "instagram";
    externalSenderId: string;
    label?: string | null;
  },
): Promise<{ ok: boolean; error: string | null }> {
  const senderId = params.externalSenderId.trim();
  if (!senderId) return { ok: false, error: "empty_sender_id" };

  const { error } = await admin.from("contact_messaging_ids").upsert(
    {
      restaurant_id: params.restaurantId,
      contact_id: params.contactId,
      platform: params.platform,
      external_sender_id: senderId,
      label: params.label?.trim() || null,
      is_primary: true,
      sort_order: 0,
    },
    { onConflict: "contact_id,platform" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function linkMetaThreadToContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    metaContactId: string;
  },
): Promise<{ ok: boolean; imported: number; error: string | null }> {
  const parsed = parseMetaPseudoContactId(params.metaContactId);
  if (!parsed) {
    return { ok: false, imported: 0, error: "invalid_meta_contact" };
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

  const linked = await upsertContactMessagingId(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    platform: parsed.platform,
    externalSenderId: parsed.senderId,
  });
  if (!linked.ok) {
    return { ok: false, imported: 0, error: linked.error };
  }

  const { data: messages, error: fetchErr } = await fetchMetaThreadMessages(
    admin,
    {
      restaurantId: params.restaurantId,
      contactId: params.metaContactId,
    },
  );

  if (fetchErr) {
    return { ok: false, imported: 0, error: fetchErr };
  }

  if (messages.length === 0) {
    return { ok: true, imported: 0, error: null };
  }

  const externalIds = messages
    .map((m) => m.external_source_id)
    .filter((id): id is string => Boolean(id?.trim()))
    .map((id) => `meta:${parsed.platform}:${id}`);

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
    .filter((m) => {
      const ext = m.external_source_id?.trim();
      if (!ext) return false;
      const key = `meta:${parsed.platform}:${ext}`;
      return !known.has(key);
    })
    .map((m) => ({
      restaurant_id: params.restaurantId,
      contact_id: params.contactId,
      platform: parsed.platform,
      direction: m.direction,
      body: m.body.trim() || " ",
      reservation_id: m.reservation_id,
      sent_by: null,
      delivery_status: m.delivery_status,
      created_at: m.created_at,
      external_source_id: `meta:${parsed.platform}:${m.external_source_id}`,
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
