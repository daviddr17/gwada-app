import "server-only";

import { buildGuestChatUrl } from "@/lib/contacts/guest-chat-url";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactGuestAccess = {
  contactId: string;
  restaurantId: string;
  guestPin: string;
  chatUrl: string;
};

export async function fetchContactGuestChatUrlTemplate(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_contact_settings")
    .select("guest_chat_url_template")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return (
    (data as { guest_chat_url_template: string | null } | null)
      ?.guest_chat_url_template ?? null
  );
}

export async function loadContactGuestAccess(
  admin: SupabaseClient,
  contactId: string,
): Promise<ContactGuestAccess | null> {
  const { data, error } = await admin
    .from("contacts")
    .select("id, restaurant_id, guest_pin")
    .eq("id", contactId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as {
    id: string;
    restaurant_id: string;
    guest_pin: string;
  };
  const pin = row.guest_pin?.trim();
  if (!pin) return null;

  const template = await fetchContactGuestChatUrlTemplate(
    admin,
    row.restaurant_id,
  );

  return {
    contactId: row.id,
    restaurantId: row.restaurant_id,
    guestPin: pin,
    chatUrl: buildGuestChatUrl(template, row.id),
  };
}

export async function verifyContactGuestPin(
  admin: SupabaseClient,
  contactId: string,
  pin: string,
): Promise<{ contactId: string; restaurantId: string } | null> {
  const { data, error } = await admin.rpc("verify_contact_guest_pin", {
    p_contact_id: contactId,
    p_pin: pin.trim(),
  });
  if (error) {
    console.warn("[gwada] verify_contact_guest_pin", error.message);
    return null;
  }
  const verifiedId = data as string | null;
  if (!verifiedId) return null;

  const { data: row } = await admin
    .from("contacts")
    .select("restaurant_id")
    .eq("id", verifiedId)
    .maybeSingle();

  if (!row) return null;
  return {
    contactId: verifiedId,
    restaurantId: (row as { restaurant_id: string }).restaurant_id,
  };
}
