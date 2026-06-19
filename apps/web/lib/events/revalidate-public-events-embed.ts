import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function revalidatePublicEventsEmbedForRestaurant(
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
  revalidatePath(`/embed/events/${encoded}`);
  revalidatePath(`/api/public/profile/${encoded}/events`);
}
