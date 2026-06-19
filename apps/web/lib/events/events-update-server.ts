import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function updateGwadaEvent(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    eventId: string;
    userId: string;
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string | null;
    ticketUrl?: string | null;
    location?: string | null;
    coverStoragePath?: string | null;
    coverMimeType?: string | null;
    removeCover?: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const updates: Record<string, unknown> = {
    updated_by: params.userId,
  };

  if (params.title !== undefined) {
    const title = params.title.trim();
    if (!title) return { ok: false, error: "title_required" };
    updates.title = title;
  }

  if (params.description !== undefined) {
    updates.description = params.description.trim();
  }

  if (params.startAt !== undefined) {
    if (Number.isNaN(new Date(params.startAt).getTime())) {
      return { ok: false, error: "invalid_start_at" };
    }
    updates.start_at = params.startAt;
  }

  if (params.endAt !== undefined) {
    if (params.endAt && Number.isNaN(new Date(params.endAt).getTime())) {
      return { ok: false, error: "invalid_end_at" };
    }
    updates.end_at = params.endAt;
  }

  if (params.ticketUrl !== undefined) {
    updates.ticket_url = params.ticketUrl?.trim() || null;
  }

  if (params.location !== undefined) {
    updates.location = params.location?.trim() || null;
  }

  if (params.removeCover) {
    updates.cover_storage_path = null;
    updates.cover_mime_type = null;
  } else if (params.coverStoragePath !== undefined) {
    updates.cover_storage_path = params.coverStoragePath;
    updates.cover_mime_type = params.coverMimeType ?? null;
  }

  const { data: existing, error: readError } = await sb
    .from("gwada_events")
    .select("start_at, end_at")
    .eq("id", params.eventId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "not_found" };

  const startAt = (updates.start_at as string | undefined) ?? (existing.start_at as string);
  const endAt =
    updates.end_at !== undefined
      ? (updates.end_at as string | null)
      : (existing.end_at as string | null);

  if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
    return { ok: false, error: "end_before_start" };
  }

  const { data, error } = await sb
    .from("gwada_events")
    .update(updates)
    .eq("id", params.eventId)
    .eq("restaurant_id", params.restaurantId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };

  return { ok: true };
}
