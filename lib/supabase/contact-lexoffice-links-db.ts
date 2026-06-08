import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactLexofficeLinkRow = {
  id: string;
  restaurant_id: string;
  contact_id: string;
  lexoffice_contact_id: string;
  lexoffice_version: number | null;
  created_at: string;
  updated_at: string;
};

export async function fetchContactLexofficeLinks(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<ContactLexofficeLinkRow[]> {
  const { data, error } = await sb
    .from("contact_lexoffice_links")
    .select(
      "id, restaurant_id, contact_id, lexoffice_contact_id, lexoffice_version, created_at, updated_at",
    )
    .eq("restaurant_id", restaurantId);

  if (error) {
    console.warn("fetchContactLexofficeLinks", error.message);
    return [];
  }
  return (data ?? []) as ContactLexofficeLinkRow[];
}

export async function fetchContactLexofficeLinkForContact(
  sb: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<ContactLexofficeLinkRow | null> {
  const { data, error } = await sb
    .from("contact_lexoffice_links")
    .select(
      "id, restaurant_id, contact_id, lexoffice_contact_id, lexoffice_version, created_at, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (error) {
    console.warn("fetchContactLexofficeLinkForContact", error.message);
    return null;
  }
  return (data as ContactLexofficeLinkRow | null) ?? null;
}

export async function upsertContactLexofficeLink(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    lexofficeContactId: string;
    lexofficeVersion?: number | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb.from("contact_lexoffice_links").upsert(
    {
      restaurant_id: params.restaurantId,
      contact_id: params.contactId,
      lexoffice_contact_id: params.lexofficeContactId,
      lexoffice_version: params.lexofficeVersion ?? null,
    },
    { onConflict: "restaurant_id,contact_id" },
  );
  return { error: error?.message ?? null };
}
