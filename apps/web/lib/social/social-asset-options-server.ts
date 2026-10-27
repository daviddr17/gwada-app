import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEventsCoverSignedUrl } from "@/lib/events/events-media";
import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type SocialAssetOption = SocialSuggestionAsset & {
  id: string;
  group: "gallery" | "menu" | "profile" | "event";
  label: string;
};

export type SocialAssetOptionGroup =
  | "gallery"
  | "menu"
  | "profile"
  | "event"
  | "all";

export async function listSocialAssetOptions(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { group?: SocialAssetOptionGroup },
): Promise<SocialAssetOption[]> {
  if (!isUuidRestaurantId(restaurantId)) return [];

  const group = opts?.group ?? "all";
  const want = (g: SocialAssetOptionGroup) => group === "all" || group === g;
  const out: SocialAssetOption[] = [];

  if (want("gallery")) {
    const { data: galleryRows } = await sb
      .from("gwada_gallery_items")
      .select("id, storage_path, thumb_storage_path, caption, is_pinned")
      .eq("restaurant_id", restaurantId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(36);

    // Signed URLs parallel — weniger Latenz im Picker.
    const galleryResolved = await Promise.all(
      (galleryRows ?? []).map(async (row) => {
        const storagePath = String(
          row.thumb_storage_path || row.storage_path || "",
        ).trim();
        if (!storagePath) return null;
        const imageUrl = await resolveGalleryMediaSignedUrl(storagePath, 7200);
        if (!imageUrl) return null;
        const label = String(row.caption ?? "").trim() || "Galerie";
        return {
          id: `gallery:${row.id}`,
          group: "gallery" as const,
          label,
          imageUrl,
          imageLabel: label,
          source: "gallery" as const,
          sourceId: String(row.id),
          storageBucket: "gallery-media",
          storagePath: String(row.storage_path || storagePath),
        };
      }),
    );
    for (const item of galleryResolved) {
      if (item) out.push(item);
    }
  }

  if (want("menu")) {
    const { data: menuRows } = await sb
      .from("menu_items")
      .select("id, name, image_url, is_active")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("list_number", { ascending: true, nullsFirst: false })
      .limit(40);

    for (const row of menuRows ?? []) {
      const imageUrl = String(row.image_url ?? "").trim();
      if (!imageUrl) continue;
      const label = String(row.name ?? "").trim() || "Gericht";
      out.push({
        id: `menu:${row.id}`,
        group: "menu",
        label,
        imageUrl,
        imageLabel: label,
        source: "menu",
        sourceId: String(row.id),
      });
    }
  }

  if (want("profile")) {
    const { data: restaurant } = await sb
      .from("restaurants")
      .select("cover_storage_path, avatar_storage_path")
      .eq("id", restaurantId)
      .maybeSingle();

    for (const kind of ["cover", "avatar"] as const) {
      const path =
        kind === "cover"
          ? restaurant?.cover_storage_path?.trim()
          : restaurant?.avatar_storage_path?.trim();
      if (!path) continue;
      const imageUrl = await resolveRestaurantProfileImageSignedUrl(
        sb,
        path,
        7200,
      );
      if (!imageUrl) continue;
      const label = kind === "cover" ? "Titelbild" : "Logo / Avatar";
      out.push({
        id: `profile:${kind}`,
        group: "profile",
        label,
        imageUrl,
        imageLabel: label,
        source: "profile",
        sourceId: kind,
        storageBucket: "restaurant-profile-images",
        storagePath: path,
      });
    }
  }

  if (!want("event")) return out;

  const { data: eventRows } = await sb
    .from("gwada_events")
    .select("id, title, cover_storage_path, start_at, status")
    .eq("restaurant_id", restaurantId)
    .in("status", ["published", "scheduled", "draft"])
    .order("start_at", { ascending: true })
    .limit(16);

  for (const row of eventRows ?? []) {
    const coverPath =
      typeof row.cover_storage_path === "string"
        ? row.cover_storage_path.trim()
        : "";
    if (!coverPath) continue;
    const imageUrl = await resolveEventsCoverSignedUrl(coverPath);
    if (!imageUrl) continue;
    const label = String(row.title ?? "").trim() || "Event";
    out.push({
      id: `event:${row.id}`,
      group: "event",
      label,
      imageUrl,
      imageLabel: label,
      source: "event",
      sourceId: String(row.id),
      storageBucket: "events-media",
      storagePath: coverPath,
    });
  }

  return out;
}
