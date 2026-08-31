import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantPersonalNoteRow,
  RestaurantPersonalNoteUpsertInput,
} from "@/lib/types/personal-notes";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

const SELECT = `
  id,
  restaurant_id,
  profile_id,
  title,
  body,
  remind_at,
  reminded_at,
  completed_at,
  archived_at,
  created_at,
  updated_at
`;

export async function fetchPersonalNotesForRestaurant(
  restaurantId: string,
): Promise<{ data: RestaurantPersonalNoteRow[]; error: string | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_personal_notes")
    .select(SELECT)
    .eq("restaurant_id", restaurantId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as RestaurantPersonalNoteRow[], error: null };
}

export async function upsertPersonalNote(params: {
  restaurantId: string;
  profileId: string;
  input: RestaurantPersonalNoteUpsertInput;
}): Promise<{ data: RestaurantPersonalNoteRow | null; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const title = params.input.title.trim();
  if (!title) return { data: null, error: "Titel fehlt" };

  if (params.input.id) {
    const { data, error } = await sb
      .from("restaurant_personal_notes")
      .update({
        title,
        body: params.input.body?.trim() || null,
        remind_at: params.input.remind_at ?? null,
        completed_at: params.input.completed_at ?? null,
        reminded_at: null,
      })
      .eq("id", params.input.id)
      .eq("restaurant_id", params.restaurantId)
      .eq("profile_id", params.profileId)
      .select(SELECT)
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as RestaurantPersonalNoteRow, error: null };
  }

  const { data, error } = await sb
    .from("restaurant_personal_notes")
    .insert({
      restaurant_id: params.restaurantId,
      profile_id: params.profileId,
      title,
      body: params.input.body?.trim() || null,
      remind_at: params.input.remind_at ?? null,
      completed_at: params.input.completed_at ?? null,
    })
    .select(SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as RestaurantPersonalNoteRow, error: null };
}

export async function completePersonalNote(params: {
  noteId: string;
  completed: boolean;
}): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurant_personal_notes")
    .update({
      completed_at: params.completed ? new Date().toISOString() : null,
    })
    .eq("id", params.noteId);
  return { error: error?.message ?? null };
}

export async function archivePersonalNote(params: {
  noteId: string;
}): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurant_personal_notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.noteId);
  return { error: error?.message ?? null };
}
