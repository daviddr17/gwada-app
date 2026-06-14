import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Embed + Gästeprofil-News nach geänderten Einstellungen aktualisieren. */
export async function revalidatePublicNewsEmbedForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const { data } = await sb
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle();

  const slug = (data?.slug as string | undefined)?.trim();
  if (!slug) return;

  const encoded = encodeURIComponent(slug);
  revalidatePath(`/embed/news/${encoded}`);
  revalidatePath(`/api/public/profile/${encoded}/news`);
}
