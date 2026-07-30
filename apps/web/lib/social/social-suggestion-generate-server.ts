import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { resolveEventsCoverSignedUrl } from "@/lib/events/events-media";
import { isUpcomingEmbedEvent } from "@/lib/events/events-embed-upcoming";
import { listPublicHolidaysInRange } from "@/lib/holidays/public-holidays-server";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import {
  captionForAmbient,
  captionForBrand,
  captionForDish,
  captionForEvent,
  captionForHoliday,
  titleForAmbient,
} from "@/lib/social/social-caption-templates";
import type { SocialTemplateId } from "@/lib/social/social-brand-kit";
import {
  ensureSocialUploadTaskInDb,
  insertSocialSuggestionsInDb,
  listSocialSuggestionsFromDb,
} from "@/lib/social/social-suggestions-db";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";

type RestaurantRow = {
  id: string;
  name: string | null;
  country: string | null;
  brand_accent_hex: string | null;
  avatar_storage_path: string | null;
  cover_storage_path: string | null;
};

type MenuDish = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
};

type GalleryAsset = {
  id: string;
  storagePath: string;
  label: string;
  imageUrl: string;
};

type EventAsset = {
  id: string;
  title: string;
  startAt: string;
  coverUrl: string | null;
  coverStoragePath: string | null;
};

function startOfWeekMonday(d = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function plannedAtForDay(weekStart: Date, dayOffset: number, hour = 11): string {
  const d = addDays(weekStart, dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function formatEventWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function loadRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantRow | null> {
  const { data, error } = await sb
    .from("restaurants")
    .select(
      "id, name, country, brand_accent_hex, avatar_storage_path, cover_storage_path",
    )
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RestaurantRow;
}

async function loadMenuDishes(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<MenuDish[]> {
  const { data, error } = await sb
    .from("menu_items")
    .select("id, name, description, image_url, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("list_number", { ascending: true, nullsFirst: false })
    .limit(80);

  if (error || !data) return [];
  return data
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
      description: String(row.description ?? "").trim(),
      imageUrl: String(row.image_url ?? "").trim(),
    }))
    .filter((d) => d.name && d.imageUrl);
}

async function loadGalleryAssets(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<GalleryAsset[]> {
  const { data, error } = await sb
    .from("gwada_gallery_items")
    .select("id, storage_path, thumb_storage_path, caption, is_pinned")
    .eq("restaurant_id", restaurantId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data) return [];

  const out: GalleryAsset[] = [];
  for (const row of data) {
    const storagePath = String(
      row.thumb_storage_path || row.storage_path || "",
    ).trim();
    if (!storagePath) continue;
    const imageUrl = await resolveGalleryMediaSignedUrl(storagePath, 7200);
    if (!imageUrl) continue;
    out.push({
      id: String(row.id),
      storagePath: String(row.storage_path || storagePath),
      label: String(row.caption ?? "").trim() || "Galerie",
      imageUrl,
    });
  }
  return out;
}

async function loadUpcomingEvents(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<EventAsset[]> {
  const { data, error } = await sb
    .from("gwada_events")
    .select("id, title, start_at, cover_storage_path, status")
    .eq("restaurant_id", restaurantId)
    .in("status", ["published", "scheduled", "draft"])
    .order("start_at", { ascending: true })
    .limit(20);

  if (error || !data) return [];

  const out: EventAsset[] = [];
  for (const row of data) {
    const startAt = String(row.start_at ?? "");
    if (!startAt || !isUpcomingEmbedEvent({ startAt })) continue;
    const coverPath =
      typeof row.cover_storage_path === "string"
        ? row.cover_storage_path.trim()
        : "";
    const coverUrl = coverPath
      ? await resolveEventsCoverSignedUrl(coverPath)
      : null;
    out.push({
      id: String(row.id),
      title: String(row.title ?? "").trim() || "Event",
      startAt,
      coverUrl,
      coverStoragePath: coverPath || null,
    });
  }
  return out;
}

async function resolveProfileAsset(
  sb: SupabaseClient,
  restaurant: RestaurantRow,
  kind: "cover" | "avatar",
): Promise<SocialSuggestionAsset | null> {
  const path =
    kind === "cover"
      ? restaurant.cover_storage_path?.trim()
      : restaurant.avatar_storage_path?.trim();
  if (!path) return null;
  const imageUrl = await resolveRestaurantProfileImageSignedUrl(sb, path, 7200);
  if (!imageUrl) return null;
  return {
    imageUrl,
    imageLabel: kind === "cover" ? "Titelbild" : "Logo",
    source: "profile",
    sourceId: kind,
    storageBucket: "restaurant-profile-images",
    storagePath: path,
  };
}

function pickUnused<T>(items: T[], used: Set<string>, keyOf: (t: T) => string): T | null {
  for (const item of items) {
    const key = keyOf(item);
    if (used.has(key)) continue;
    used.add(key);
    return item;
  }
  return null;
}

export async function generateSocialSuggestionsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { force?: boolean },
): Promise<{
  created: number;
  pending: number;
  tasksCreated: boolean;
  skippedReason?: string;
}> {
  const kit = await fetchSocialBrandKitFromDb(sb, restaurantId);
  if (!kit.enabled) {
    return { created: 0, pending: 0, tasksCreated: false, skippedReason: "disabled" };
  }

  const existing = await listSocialSuggestionsFromDb(sb, restaurantId, {
    statuses: ["pending", "needs_asset"],
    limit: 40,
  });
  const weekStart = startOfWeekMonday();
  const weekEnd = addDays(weekStart, 7);
  const pendingThisWeek = existing.filter((s) => {
    const t = new Date(s.plannedAt).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });

  if (!opts?.force && pendingThisWeek.length >= kit.weeklyPostTarget) {
    return {
      created: 0,
      pending: pendingThisWeek.length,
      tasksCreated: false,
      skippedReason: "already_filled",
    };
  }

  const restaurant = await loadRestaurant(sb, restaurantId);
  if (!restaurant) {
    return {
      created: 0,
      pending: pendingThisWeek.length,
      tasksCreated: false,
      skippedReason: "restaurant_missing",
    };
  }

  const restaurantName = restaurant.name?.trim() || "Unser Restaurant";
  const [dishes, gallery, events] = await Promise.all([
    loadMenuDishes(sb, restaurantId),
    loadGalleryAssets(sb, restaurantId),
    loadUpcomingEvents(sb, restaurantId),
  ]);

  const coverAsset = await resolveProfileAsset(sb, restaurant, "cover");
  const avatarAsset = await resolveProfileAsset(sb, restaurant, "avatar");

  const usableImageCount =
    dishes.length +
    gallery.length +
    (coverAsset ? 1 : 0) +
    events.filter((e) => e.coverUrl).length;

  let tasksCreated = false;
  if (usableImageCount < 5) {
    await ensureSocialUploadTaskInDb(sb, restaurantId);
    tasksCreated = true;
  }

  const fromYmd = ymd(new Date());
  const toYmd = ymd(addDays(new Date(), 14));
  const holidays = await listPublicHolidaysInRange(
    restaurant.country?.trim() || "Deutschland",
    fromYmd,
    toYmd,
  );

  let need = Math.max(0, kit.weeklyPostTarget - pendingThisWeek.length);
  if (opts?.force && need === 0) need = 1;
  if (need === 0) {
    return { created: 0, pending: pendingThisWeek.length, tasksCreated };
  }

  const usedDishIds = new Set(
    pendingThisWeek
      .filter((s) => s.slotKind === "menu_dish")
      .map((s) => String(s.source.dishId ?? "")),
  );
  const usedGalleryIds = new Set<string>();
  const usedEventIds = new Set(
    pendingThisWeek
      .filter((s) => s.slotKind === "event")
      .map((s) => String(s.source.eventId ?? "")),
  );
  const usedHolidayDates = new Set(
    pendingThisWeek
      .filter((s) => s.slotKind === "holiday")
      .map((s) => String(s.source.date ?? "")),
  );

  type Draft = {
    restaurantId: string;
    status: "pending" | "needs_asset";
    slotKind: "holiday" | "menu_dish" | "event" | "brand" | "ambient";
    templateId: SocialTemplateId;
    plannedAt: string;
    title: string | null;
    caption: string;
    platforms: string[];
    source: Record<string, unknown>;
    asset: SocialSuggestionAsset;
  };

  const drafts: Draft[] = [];
  const daySlots = [1, 3, 5, 2, 4, 6, 0]; // Tue, Thu, Sat, Wed, Fri, Sun, Mon
  let slotIndex = 0;

  const nextPlan = () => {
    const day = daySlots[slotIndex % daySlots.length] ?? 1;
    slotIndex += 1;
    return plannedAtForDay(weekStart, day, 11 + (slotIndex % 2));
  };

  // 1) Holidays
  for (const h of holidays) {
    if (drafts.length >= need) break;
    if (usedHolidayDates.has(h.date)) continue;
    usedHolidayDates.add(h.date);

    const galleryPick = pickUnused(gallery, usedGalleryIds, (g) => g.id);
    const dishPick = pickUnused(dishes, usedDishIds, (d) => d.id);
    let asset: SocialSuggestionAsset | null = null;
    if (galleryPick) {
      asset = {
        imageUrl: galleryPick.imageUrl,
        imageLabel: galleryPick.label,
        source: "gallery",
        sourceId: galleryPick.id,
        storageBucket: "gallery-media",
        storagePath: galleryPick.storagePath,
      };
    } else if (dishPick) {
      asset = {
        imageUrl: dishPick.imageUrl,
        imageLabel: dishPick.name,
        source: "menu",
        sourceId: dishPick.id,
      };
    } else if (coverAsset) {
      asset = coverAsset;
    } else if (kit.imageStrategy !== "own_first") {
      // brand_card without photo still possible as typography card
      asset = { imageUrl: null, source: "none" };
    }

    if (!asset) continue;

    const status =
      asset.imageUrl || kit.imageStrategy !== "own_first"
        ? "pending"
        : "needs_asset";

    drafts.push({
      restaurantId,
      status,
      slotKind: "holiday",
      templateId: asset.imageUrl ? "food_hero" : "brand_card",
      plannedAt: `${h.date}T10:00:00.000Z`,
      title: h.name,
      caption: captionForHoliday({
        kit,
        restaurantName,
        holidayName: h.name,
      }),
      platforms: [...kit.publishPlatforms],
      source: { date: h.date, holidayName: h.name },
      asset,
    });
  }

  // 2) Events with cover
  for (const ev of events) {
    if (drafts.length >= need) break;
    if (usedEventIds.has(ev.id)) continue;
    if (!ev.coverUrl && kit.imageStrategy === "own_first") continue;
    usedEventIds.add(ev.id);

    drafts.push({
      restaurantId,
      status: ev.coverUrl ? "pending" : "needs_asset",
      slotKind: "event",
      templateId: "brand_card",
      plannedAt: nextPlan(),
      title: ev.title,
      caption: captionForEvent({
        kit,
        restaurantName,
        eventTitle: ev.title,
        whenLabel: formatEventWhen(ev.startAt),
      }),
      platforms: [...kit.publishPlatforms],
      source: { eventId: ev.id, startAt: ev.startAt },
      asset: {
        imageUrl: ev.coverUrl,
        imageLabel: ev.title,
        source: "event",
        sourceId: ev.id,
        storageBucket: ev.coverStoragePath ? "events-media" : undefined,
        storagePath: ev.coverStoragePath ?? undefined,
      },
    });
  }

  // 3) Menu dishes
  while (drafts.length < need) {
    const dish = pickUnused(dishes, usedDishIds, (d) => d.id);
    if (!dish) break;
    drafts.push({
      restaurantId,
      status: "pending",
      slotKind: "menu_dish",
      templateId: "food_hero",
      plannedAt: nextPlan(),
      title: dish.name,
      caption: captionForDish({
        kit,
        restaurantName,
        dishName: dish.name,
        dishDescription: dish.description,
      }),
      platforms: [...kit.publishPlatforms],
      source: { dishId: dish.id, dishName: dish.name },
      asset: {
        imageUrl: dish.imageUrl,
        imageLabel: dish.name,
        source: "menu",
        sourceId: dish.id,
      },
    });
  }

  // 4) Ambient from gallery
  while (drafts.length < need) {
    const g = pickUnused(gallery, usedGalleryIds, (x) => x.id);
    if (!g) break;
    drafts.push({
      restaurantId,
      status: "pending",
      slotKind: "ambient",
      templateId: "food_hero",
      plannedAt: nextPlan(),
      title: titleForAmbient(g.label),
      caption: captionForAmbient({
        kit,
        restaurantName,
        imageCaption: g.label,
      }),
      platforms: [...kit.publishPlatforms],
      source: { galleryItemId: g.id, imageCaption: g.label },
      asset: {
        imageUrl: g.imageUrl,
        imageLabel: g.label,
        source: "gallery",
        sourceId: g.id,
        storageBucket: "gallery-media",
        storagePath: g.storagePath,
      },
    });
  }

  // 5) Brand / cover fallback
  while (drafts.length < need) {
    const asset = coverAsset ?? avatarAsset;
    if (!asset && kit.imageStrategy === "own_first") break;
    drafts.push({
      restaurantId,
      status: asset?.imageUrl ? "pending" : "needs_asset",
      slotKind: "brand",
      templateId: "brand_card",
      plannedAt: nextPlan(),
      title: restaurantName,
      caption: captionForBrand({ kit, restaurantName }),
      platforms: [...kit.publishPlatforms],
      source: { kind: "brand" },
      asset: asset ?? { imageUrl: null, source: "none" },
    });
    // only one brand fallback without looping forever on same asset
    if (!asset) break;
    break;
  }

  const created = await insertSocialSuggestionsInDb(sb, drafts);
  const pending = pendingThisWeek.length + created;
  return { created, pending, tasksCreated };
}
