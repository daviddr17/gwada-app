"use client";

import { EmbedGalleryWidget } from "@/components/embed/embed-gallery-widget";
import type { PublicEmbedGallery } from "@/lib/gallery/public-gallery-server";

export function RestaurantPublicProfileGallery({
  gallery,
}: {
  gallery: PublicEmbedGallery;
}) {
  return <EmbedGalleryWidget data={gallery} variant="profileSheet" />;
}
