import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedPinModule } from "@/lib/feed-pin/feed-pin-types";
import { revalidatePublicEventsEmbedForRestaurant } from "@/lib/events/revalidate-public-events-embed";
import { revalidatePublicNewsEmbedForRestaurant } from "@/lib/news/revalidate-public-news-embed";
import { revalidatePublicReviewsEmbedForRestaurant } from "@/lib/reviews/revalidate-public-reviews-embed";

async function revalidatePublicGalleryEmbedForRestaurant(
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
  revalidatePath(`/embed/gallery/${encoded}`);
  revalidatePath(`/api/public/profile/${encoded}/gallery`);
}

export async function revalidateFeedPinModule(
  sb: SupabaseClient,
  restaurantId: string,
  module: FeedPinModule,
): Promise<void> {
  switch (module) {
    case "news":
      await revalidatePublicNewsEmbedForRestaurant(sb, restaurantId);
      break;
    case "events":
      await revalidatePublicEventsEmbedForRestaurant(sb, restaurantId);
      break;
    case "gallery":
      await revalidatePublicGalleryEmbedForRestaurant(sb, restaurantId);
      break;
    case "reviews":
      await revalidatePublicReviewsEmbedForRestaurant(sb, restaurantId);
      break;
  }
}
