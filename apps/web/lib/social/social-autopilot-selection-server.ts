import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readCachedGalleryItems } from "@/lib/gallery/gallery-cache-db";
import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { socialAutopilotIdeaId } from "@/lib/social/social-autopilot-ideas";
import type { SocialAutopilotCatalogIdea } from "@/lib/social/social-autopilot-ideas-server";
import { clipAutopilotText } from "@/lib/social/social-autopilot-bounds";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Max. Freitext für KI-Post-Vorgaben. */
export const SOCIAL_AUTOPILOT_USER_BRIEF_MAX = 500;

export function parseAutopilotUserBrief(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return clipAutopilotText(raw.trim(), SOCIAL_AUTOPILOT_USER_BRIEF_MAX);
}

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseAutopilotMenuIds(raw: unknown): string[] {
  return parseIdList(raw);
}

export function parseAutopilotGalleryIds(raw: unknown): string[] {
  return parseIdList(raw);
}

async function resolveMenuIdea(
  sb: SupabaseClient,
  restaurantId: string,
  menuId: string,
): Promise<SocialAutopilotCatalogIdea | null> {
  const { data } = await sb
    .from("menu_items")
    .select("id, name, description, image_url, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("id", menuId)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  const imageUrl = String(data.image_url ?? "").trim();
  if (!imageUrl) return null;
  const name = String(data.name ?? "").trim() || "Gericht";
  const description = String(data.description ?? "").trim();
  const id = socialAutopilotIdeaId("menu", String(data.id));
  return {
    id,
    slotKind: "menu_dish",
    sourceBucket: "menu",
    title: name,
    reasonLabel: "Speisekarte",
    reasonDetail: name,
    imageUrl,
    imageLabel: name,
    dishDescription: description || undefined,
    asset: {
      imageUrl,
      imageLabel: name,
      source: "menu",
      sourceId: String(data.id),
    },
  };
}

async function resolveExternalCachedGalleryIdea(
  sb: SupabaseClient,
  restaurantId: string,
  galleryId: string,
): Promise<SocialAutopilotCatalogIdea | null> {
  const cached = await readCachedGalleryItems(sb, restaurantId, [
    "facebook",
    "instagram",
    "google_business",
  ]);
  const hit = cached.find((item) => item.id === galleryId);
  if (!hit || hit.mediaKind !== "image") return null;
  const imageUrl = (
    hit.fullUrl ||
    hit.previewUrl ||
    hit.thumbUrl ||
    ""
  ).trim();
  if (!imageUrl) return null;
  const label =
    hit.caption?.trim() || hit.title?.trim() || "Galerie";
  const id = socialAutopilotIdeaId("gallery", galleryId);
  return {
    id,
    slotKind: "ambient",
    sourceBucket: "gallery",
    title: label,
    reasonLabel: "Galerie",
    reasonDetail: label,
    imageUrl,
    imageLabel: label,
    asset: {
      imageUrl,
      imageLabel: label,
      source: "gallery",
      sourceId: galleryId,
    },
  };
}

async function resolveGalleryIdea(
  sb: SupabaseClient,
  restaurantId: string,
  galleryId: string,
): Promise<SocialAutopilotCatalogIdea | null> {
  const rawId = galleryId.trim();
  if (!rawId) return null;

  // Prefixed Cache-IDs (facebook:… / instagram:… / google_business:…)
  if (rawId.includes(":")) {
    return resolveExternalCachedGalleryIdea(sb, restaurantId, rawId);
  }

  if (!UUID_RE.test(rawId)) {
    return resolveExternalCachedGalleryIdea(sb, restaurantId, rawId);
  }

  const { data } = await sb
    .from("gwada_gallery_items")
    .select("id, storage_path, thumb_storage_path, caption")
    .eq("restaurant_id", restaurantId)
    .eq("id", rawId)
    .maybeSingle();
  if (!data) {
    return resolveExternalCachedGalleryIdea(sb, restaurantId, rawId);
  }
  const storagePath = String(
    data.thumb_storage_path || data.storage_path || "",
  ).trim();
  if (!storagePath) return null;
  const imageUrl = await resolveGalleryMediaSignedUrl(storagePath, 7200);
  if (!imageUrl) return null;
  const label = String(data.caption ?? "").trim() || "Galerie";
  const id = socialAutopilotIdeaId("gallery", String(data.id));
  return {
    id,
    slotKind: "ambient",
    sourceBucket: "gallery",
    title: label,
    reasonLabel: "Galerie",
    reasonDetail: label,
    imageUrl,
    imageLabel: label,
    asset: {
      imageUrl,
      imageLabel: label,
      source: "gallery",
      sourceId: String(data.id),
      storageBucket: "gallery-media",
      storagePath: String(data.storage_path || storagePath),
    },
  };
}

/** Stil-only: Titelbild/Logo als Marken-Post. */
async function resolveStyleOnlyIdea(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<SocialAutopilotCatalogIdea | null> {
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("name, cover_storage_path, avatar_storage_path")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!restaurant) return null;
  const name =
    (typeof restaurant.name === "string" && restaurant.name.trim()) ||
    "Unser Restaurant";

  for (const kind of ["cover", "avatar"] as const) {
    const path =
      kind === "cover"
        ? restaurant.cover_storage_path?.trim()
        : restaurant.avatar_storage_path?.trim();
    if (!path) continue;
    const imageUrl = await resolveRestaurantProfileImageSignedUrl(
      sb,
      path,
      7200,
    );
    if (!imageUrl) continue;
    const label = kind === "cover" ? "Titelbild" : "Logo";
    const id = socialAutopilotIdeaId("brand", kind);
    return {
      id,
      slotKind: "brand",
      sourceBucket: "ai",
      title: name,
      reasonLabel: "Stil",
      reasonDetail: label,
      imageUrl,
      imageLabel: label,
      asset: {
        imageUrl,
        imageLabel: label,
        source: "profile",
        sourceId: kind,
        storageBucket: "restaurant-profile-images",
        storagePath: path,
      },
    };
  }
  return null;
}

/**
 * Baut genau eine Katalog-Idee aus User-Vorgaben (Speisekarte / Galerie / Stil).
 * Kein Ideas-Pitch-LLM — Caption schreibt die Restaurant-KI im Generate.
 */
export async function resolveAutopilotSingleSelection(
  sb: SupabaseClient,
  restaurantId: string,
  opts: {
    menuIds?: string[];
    galleryIds?: string[];
    /** Explizit ohne Medien — Marken-/Stil-Post. */
    styleOnly?: boolean;
    /** Freitext-Thema vom Nutzer (kein LLM bis Generate). */
    userBrief?: string;
  },
): Promise<{
  idea: SocialAutopilotCatalogIdea | null;
  skippedReason?: "needs_media" | "selection_required";
}> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { idea: null, skippedReason: "selection_required" };
  }

  const menuIds = opts.menuIds ?? [];
  const galleryIds = opts.galleryIds ?? [];
  const userBrief = parseAutopilotUserBrief(opts.userBrief);

  const withBrief = (
    idea: SocialAutopilotCatalogIdea,
  ): SocialAutopilotCatalogIdea => {
    if (!userBrief) return idea;
    // Freitext NICHT als captionDirection — sonst überschreibt z. B. Halloween
    // ein Sommerterassen-Foto. Brief läuft separat als facts.userBrief.
    return {
      ...idea,
      ...(idea.slotKind === "brand"
        ? { title: userBrief.slice(0, 80) }
        : {}),
      aiSuggested: true,
    };
  };

  for (const menuId of menuIds) {
    const idea = await resolveMenuIdea(sb, restaurantId, menuId);
    if (idea) return { idea: withBrief(idea) };
  }
  for (const galleryId of galleryIds) {
    const idea = await resolveGalleryIdea(sb, restaurantId, galleryId);
    if (idea) return { idea: withBrief(idea) };
  }

  // Keine Medien gewählt → Stil/Marke (Restaurant-KI + Brand Kit).
  // Freitext allein reicht ebenfalls (styleOnly).
  if (
    opts.styleOnly ||
    userBrief ||
    (menuIds.length === 0 && galleryIds.length === 0)
  ) {
    const idea = await resolveStyleOnlyIdea(sb, restaurantId);
    if (idea) return { idea: withBrief(idea) };
    return { idea: null, skippedReason: "needs_media" };
  }

  return { idea: null, skippedReason: "needs_media" };
}
