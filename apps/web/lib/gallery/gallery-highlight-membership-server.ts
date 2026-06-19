import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type GalleryHighlightMembershipRow = {
  id: string;
  title: string;
  member: boolean;
};

async function assertGwadaGalleryItem(
  sb: SupabaseClient,
  restaurantId: string,
  itemId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("gwada_gallery_items")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("id", itemId)
    .maybeSingle();
  return Boolean(data);
}

export async function readGalleryHighlightMembership(
  sb: SupabaseClient,
  restaurantId: string,
  itemId: string,
): Promise<GalleryHighlightMembershipRow[]> {
  const itemOk = await assertGwadaGalleryItem(sb, restaurantId, itemId);
  if (!itemOk) return [];

  const { data: highlights, error } = await sb
    .from("gwada_gallery_highlights")
    .select("id, title")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error || !highlights?.length) return [];

  const { data: links } = await sb
    .from("gwada_gallery_highlight_items")
    .select("highlight_id")
    .eq("item_id", itemId);

  const memberIds = new Set(
    (links ?? []).map((row) => row.highlight_id as string),
  );

  return (highlights as { id: string; title: string }[]).map((h) => ({
    id: h.id,
    title: h.title,
    member: memberIds.has(h.id),
  }));
}

export async function syncGalleryItemHighlightMembership(
  sb: SupabaseClient,
  restaurantId: string,
  itemId: string,
  highlightIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const itemOk = await assertGwadaGalleryItem(sb, restaurantId, itemId);
  if (!itemOk) return { ok: false, error: "invalid_item_id" };

  const uniqueHighlightIds = [...new Set(highlightIds.filter(Boolean))];

  if (uniqueHighlightIds.length > 0) {
    const { data: validHighlights, error: highlightsError } = await sb
      .from("gwada_gallery_highlights")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .in("id", uniqueHighlightIds);

    if (highlightsError) {
      return { ok: false, error: highlightsError.message };
    }
    if ((validHighlights ?? []).length !== uniqueHighlightIds.length) {
      return { ok: false, error: "invalid_highlight_ids" };
    }
  }

  const { data: restaurantHighlights } = await sb
    .from("gwada_gallery_highlights")
    .select("id")
    .eq("restaurant_id", restaurantId);

  const allHighlightIds = (restaurantHighlights ?? []).map(
    (row) => row.id as string,
  );

  const { data: existingLinks } = await sb
    .from("gwada_gallery_highlight_items")
    .select("highlight_id")
    .eq("item_id", itemId)
    .in("highlight_id", allHighlightIds);

  const currentIds = new Set(
    (existingLinks ?? []).map((row) => row.highlight_id as string),
  );
  const targetIds = new Set(uniqueHighlightIds);

  for (const highlightId of targetIds) {
    if (currentIds.has(highlightId)) continue;

    const { count } = await sb
      .from("gwada_gallery_highlight_items")
      .select("item_id", { count: "exact", head: true })
      .eq("highlight_id", highlightId);

    const { error: insertError } = await sb
      .from("gwada_gallery_highlight_items")
      .insert({
        highlight_id: highlightId,
        item_id: itemId,
        sort_order: count ?? 0,
      });

    if (insertError) {
      return { ok: false, error: insertError.message };
    }
  }

  const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
  if (toRemove.length > 0) {
    const { error: deleteError } = await sb
      .from("gwada_gallery_highlight_items")
      .delete()
      .eq("item_id", itemId)
      .in("highlight_id", toRemove);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }
  }

  return { ok: true };
}
