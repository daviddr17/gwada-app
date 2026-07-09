import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ContactNoteRow = {
  id: string;
  contact_id: string;
  restaurant_id: string;
  body: string;
  created_at: string;
  created_by: string | null;
};

export async function fetchContactNotes(params: {
  restaurantId: string;
  contactId: string;
}): Promise<{ data: ContactNoteRow[]; error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contactId)
  ) {
    return { data: [], error: null };
  }

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_notes")
    .select("id, contact_id, restaurant_id, body, created_at, created_by")
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as ContactNoteRow[], error: null };
}

export async function insertContactNote(params: {
  restaurantId: string;
  contactId: string;
  body: string;
}): Promise<{ data: ContactNoteRow | null; error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contactId)
  ) {
    return { data: null, error: new Error("Ungültige ID.") };
  }

  const body = params.body.trim();
  if (!body) {
    return { data: null, error: new Error("Notiz darf nicht leer sein.") };
  }

  const sb = createSupabaseBrowserClient();
  const { data: userData } = await sb.auth.getUser();
  const createdBy = userData.user?.id ?? null;

  const { data, error } = await sb
    .from("contact_notes")
    .insert({
      restaurant_id: params.restaurantId,
      contact_id: params.contactId,
      body,
      created_by: createdBy,
    })
    .select("id, contact_id, restaurant_id, body, created_at, created_by")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as ContactNoteRow, error: null };
}
