import "server-only";

import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { fetchGwadaGalleryItemById } from "@/lib/gallery/connectors/gwada-gallery-connector";
import type { UnifiedGalleryHighlight } from "@/lib/gallery/unified-gallery-item";
import type { SupabaseClient } from "@supabase/supabase-js";

type HighlightRow = {
  id: string;
  title: string;
  cover_storage_path: string | null;
  sort_order: number;
};

export async function readGwadaGalleryHighlights(
  restaurantId: string,
  sb: SupabaseClient,
): Promise<UnifiedGalleryHighlight[]> {
  const { data: highlights, error } = await sb
    .from("gwada_gallery_highlights")
    .select("id, title, cover_storage_path, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error || !highlights?.length) return [];

  const result: UnifiedGalleryHighlight[] = [];

  for (const highlight of highlights as HighlightRow[]) {
    const { data: links } = await sb
      .from("gwada_gallery_highlight_items")
      .select("item_id, sort_order")
      .eq("highlight_id", highlight.id)
      .order("sort_order", { ascending: true });

    const items = [];
    for (const link of links ?? []) {
      const item = await fetchGwadaGalleryItemById(
        sb,
        restaurantId,
        link.item_id as string,
      );
      if (item) items.push(item);
    }

    let coverUrl =
      items[0]?.previewUrl ??
      (highlight.cover_storage_path
        ? await resolveGalleryMediaSignedUrl(highlight.cover_storage_path)
        : null);

    if (!coverUrl) continue;

    result.push({
      id: `gwada:${highlight.id}`,
      platform: "gwada",
      title: highlight.title,
      coverUrl,
      itemIds: items.map((item) => item.id),
      items,
    });
  }

  return result;
}
