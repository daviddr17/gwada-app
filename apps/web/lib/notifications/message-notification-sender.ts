import "server-only";

import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import {
  emailAddressFromPseudoContactId,
  isEmailPseudoContactId,
} from "@/lib/contact-messages/email-pseudo-contact";
import { displayNameFromWahaChatId } from "@/lib/contact-messages/waha-chat-label";
import {
  digitsFromWhatsAppChatId,
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MessageNotificationSenderPayload = {
  contactName: string;
  senderEmail?: string;
  senderPhone?: string;
};

function phoneDisplayFromChatId(chatId: string): string | null {
  const fromLabel = displayNameFromWahaChatId(chatId);
  if (fromLabel && !/^whatsapp$/i.test(fromLabel.trim())) {
    return fromLabel.trim();
  }
  const digits = digitsFromWhatsAppChatId(chatId);
  if (!digits) return null;
  return `+${digits}`;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Kein doppeltes Anzeigen, wenn Name und Telefon dieselbe Nummer sind. */
export function senderPhoneDistinctFromName(
  name: string | null | undefined,
  phone: string | null | undefined,
): boolean {
  if (!phone?.trim()) return false;
  if (!name?.trim()) return true;
  const phoneDigits = digitsOnly(phone);
  const nameDigits = digitsOnly(name);
  if (phoneDigits.length >= 8 && phoneDigits === nameDigits) return false;
  if (name.trim() === phone.trim()) return false;
  return true;
}

export async function resolveMessageNotificationSender(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    platform: ContactMessagePlatform;
  },
): Promise<MessageNotificationSenderPayload> {
  const { restaurantId, contactId } = params;

  if (isEmailPseudoContactId(contactId)) {
    const email = emailAddressFromPseudoContactId(contactId);
    return {
      contactName: email ?? "E-Mail",
      senderEmail: email ?? undefined,
    };
  }

  if (isWahaPseudoContactId(contactId)) {
    const chatId = wahaChatIdFromPseudoContactId(contactId);
    const phone = chatId ? phoneDisplayFromChatId(chatId) : null;
    return {
      contactName: phone ?? "WhatsApp",
      senderPhone: phone ?? undefined,
    };
  }

  const { data: contact } = await admin
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", contactId)
    .maybeSingle();

  const contactName = contact
    ? contactDisplayName({
        first_name: (contact as { first_name: string }).first_name,
        last_name: (contact as { last_name: string }).last_name,
      })
    : "Kontakt";

  const [{ data: emailRows }, { data: phoneRows }] = await Promise.all([
    admin
      .from("contact_emails")
      .select("email")
      .eq("restaurant_id", restaurantId)
      .eq("contact_id", contactId)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1),
    admin
      .from("contact_phones")
      .select("phone_display")
      .eq("restaurant_id", restaurantId)
      .eq("contact_id", contactId)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1),
  ]);

  const senderEmail = (emailRows?.[0] as { email?: string } | undefined)?.email
    ?.trim();
  const senderPhone = (
    phoneRows?.[0] as { phone_display?: string } | undefined
  )?.phone_display?.trim();

  return {
    contactName: contactName || "Kontakt",
    senderEmail: senderEmail || undefined,
    senderPhone: senderPhone || undefined,
  };
}
