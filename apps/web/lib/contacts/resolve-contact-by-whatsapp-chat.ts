import "server-only";

import { normalizeContactPhone } from "@/lib/contacts/normalize-contact-identity";
import { digitsFromWhatsAppChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { isWahaDirectMessageChatId } from "@/lib/waha/waha-lids";
import type { SupabaseClient } from "@supabase/supabase-js";

export function whatsappChatIdFromPayloadAddress(
  address: string | undefined,
): string | null {
  const raw = address?.trim();
  if (!raw) return null;
  if (raw.includes("@")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits}@c.us`;
}

/** Kontakt anhand WA-JID / Telefonnummer (Restaurant-Scope). */
export async function resolveContactIdByWhatsappChat(
  admin: SupabaseClient,
  params: { restaurantId: string; chatId: string },
): Promise<string | null> {
  const chatId = params.chatId.trim();
  if (!chatId || !isWahaDirectMessageChatId(chatId)) return null;

  const digits =
    digitsFromWhatsAppChatId(chatId) ?? chatId.replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;

  const normalized = normalizeContactPhone(digits);
  if (!normalized) return null;

  const { data: phoneRow } = await admin
    .from("contact_phones")
    .select("contact_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("phone_normalized", normalized)
    .limit(1)
    .maybeSingle();

  if (phoneRow) {
    return (phoneRow as { contact_id: string }).contact_id;
  }

  const { data: contacts } = await admin
    .from("contacts")
    .select(
      `
      id,
      contact_phones ( phone_display, phone_normalized )
    `,
    )
    .eq("restaurant_id", params.restaurantId);

  for (const c of contacts ?? []) {
    const row = c as Record<string, unknown>;
    const phones = row.contact_phones;
    const list = Array.isArray(phones) ? phones : [];
    for (const p of list) {
      const pr = p as { phone_display: string; phone_normalized: string };
      const norm =
        pr.phone_normalized?.trim() ||
        normalizeContactPhone(pr.phone_display);
      if (norm === normalized) return row.id as string;
    }
  }

  return null;
}
