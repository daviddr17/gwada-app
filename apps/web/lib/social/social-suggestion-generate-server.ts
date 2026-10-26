import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { resolveEventsCoverSignedUrl } from "@/lib/events/events-media";
import { isUpcomingEmbedEvent } from "@/lib/events/events-embed-upcoming";
import { listPublicHolidaysInRange } from "@/lib/holidays/public-holidays-server";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import {
  clampAutopilotItemCount,
  SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
  SOCIAL_AUTOPILOT_MAX_LLM_CALLS,
} from "@/lib/social/social-autopilot-bounds";
import {
  applyAutopilotCaptionResults,
  rewriteAutopilotCaptionsWithLlm,
  type SocialAutopilotCaptionJob,
} from "@/lib/social/social-autopilot-llm";
import {
  filterRelevantHolidays,
  isEventRelevantSoon,
  rotateBySeed,
  SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS,
} from "@/lib/social/social-autopilot-relevance";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import {
  feedLayoutToLegacyTemplate,
  pickFeedLayoutForSlot,
} from "@/lib/social/social-feed-layout";
import type { SocialFeedLayoutId } from "@/lib/social/social-feed-brand-system";
import {
  captionForAmbient,
  captionForBrand,
  captionForDish,
  captionForEvent,
  captionForHoliday,
  overlayLineFromCaption,
  titleForAmbient,
} from "@/lib/social/social-caption-templates";
import type {
  SocialHeroAsset,
  SocialTemplateId,
} from "@/lib/social/social-brand-kit";
import {
  ensureSocialUploadTaskInDb,
  insertSocialSuggestionsInDb,
  listSocialSuggestionsFromDb,
  skipPendingSocialSuggestionsInDb,
} from "@/lib/social/social-suggestions-db";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import { fetchRestaurantAssistantRuntime } from "@/lib/supabase/restaurant-assistant-key-db";

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

function resolveHeroAsset(params: {
  hero: SocialHeroAsset;
  dishes: MenuDish[];
  gallery: GalleryAsset[];
  coverAsset: SocialSuggestionAsset | null;
  avatarAsset: SocialSuggestionAsset | null;
  usedDishIds: Set<string>;
  usedGalleryIds: Set<string>;
}): SocialSuggestionAsset | null {
  const { hero } = params;
  if (hero.source === "menu") {
    if (params.usedDishIds.has(hero.id)) return null;
    const dish = params.dishes.find((d) => d.id === hero.id);
    if (!dish) return null;
    params.usedDishIds.add(dish.id);
    return {
      imageUrl: dish.imageUrl,
      imageLabel: dish.name,
      source: "menu",
      sourceId: dish.id,
    };
  }
  if (hero.source === "gallery") {
    if (params.usedGalleryIds.has(hero.id)) return null;
    const g = params.gallery.find((x) => x.id === hero.id);
    if (!g) return null;
    params.usedGalleryIds.add(g.id);
    return {
      imageUrl: g.imageUrl,
      imageLabel: g.label,
      source: "gallery",
      sourceId: g.id,
      storageBucket: "gallery-media",
      storagePath: g.storagePath,
    };
  }
  if (hero.source === "profile") {
    if (hero.id === "cover" && params.coverAsset) return params.coverAsset;
    if (hero.id === "avatar" && params.avatarAsset) return params.avatarAsset;
  }
  return null;
}

function prioritizeHeroDishes(
  dishes: MenuDish[],
  heroes: SocialHeroAsset[],
): MenuDish[] {
  const heroIds = new Set(
    heroes.filter((h) => h.source === "menu").map((h) => h.id),
  );
  if (!heroIds.size) return dishes;
  const first = dishes.filter((d) => heroIds.has(d.id));
  const rest = dishes.filter((d) => !heroIds.has(d.id));
  return [...first, ...rest];
}

function prioritizeHeroGallery(
  gallery: GalleryAsset[],
  heroes: SocialHeroAsset[],
): GalleryAsset[] {
  const heroIds = new Set(
    heroes.filter((h) => h.source === "gallery").map((h) => h.id),
  );
  if (!heroIds.size) return gallery;
  const first = gallery.filter((g) => heroIds.has(g.id));
  const rest = gallery.filter((g) => !heroIds.has(g.id));
  return [...first, ...rest];
}

export type SocialSuggestionGenerateResult = {
  created: number;
  pending: number;
  tasksCreated: boolean;
  skippedReason?: string;
  /** Restaurant-Assistent OpenAI/Grok-Key vorhanden. */
  aiConfigured: boolean;
  aiProvider?: "openai" | "grok";
  llmCalls?: number;
  llmApplied?: number;
  /** Hard cap documentation for clients / UI. */
  caps?: {
    maxItemsPerRun: number;
    maxLlmCalls: number;
  };
};

export async function generateSocialSuggestionsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { force?: boolean },
): Promise<SocialSuggestionGenerateResult> {
  const caps = {
    maxItemsPerRun: SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
    maxLlmCalls: SOCIAL_AUTOPILOT_MAX_LLM_CALLS,
  };

  const llmRuntime = await fetchRestaurantAssistantRuntime(restaurantId);
  const aiConfigured = Boolean(llmRuntime?.apiKey);
  const aiProvider = llmRuntime?.provider;

  if (!aiConfigured || !llmRuntime) {
    return {
      created: 0,
      pending: 0,
      tasksCreated: false,
      skippedReason: "ai_not_configured",
      aiConfigured: false,
      caps,
    };
  }

  const kit = await fetchSocialBrandKitFromDb(sb, restaurantId);
  if (!kit.enabled) {
    return {
      created: 0,
      pending: 0,
      tasksCreated: false,
      skippedReason: "disabled",
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  let existing = await listSocialSuggestionsFromDb(sb, restaurantId, {
    statuses: ["pending", "needs_asset"],
    limit: 40,
  });
  const weekStart = startOfWeekMonday();
  const weekEnd = addDays(weekStart, 7);
  let pendingThisWeek = existing.filter((s) => {
    const t = new Date(s.plannedAt).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });

  // „Neu vorschlagen“: alle offenen Vorschläge verwerfen (nicht nur ID-Liste),
  // damit keine Text-/Duplikat-Reste in der Queue bleiben.
  if (opts?.force) {
    await skipPendingSocialSuggestionsInDb(sb, restaurantId);
    existing = [];
    pendingThisWeek = [];
  }

  if (!opts?.force && pendingThisWeek.length >= kit.weeklyPostTarget) {
    return {
      created: 0,
      pending: pendingThisWeek.length,
      tasksCreated: false,
      skippedReason: "already_filled",
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  const restaurant = await loadRestaurant(sb, restaurantId);
  if (!restaurant) {
    return {
      created: 0,
      pending: pendingThisWeek.length,
      tasksCreated: false,
      skippedReason: "restaurant_missing",
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  const restaurantName = restaurant.name?.trim() || "Unser Restaurant";
  const now = new Date();
  const [dishesRaw, galleryRaw, eventsRaw] = await Promise.all([
    loadMenuDishes(sb, restaurantId),
    loadGalleryAssets(sb, restaurantId),
    loadUpcomingEvents(sb, restaurantId),
  ]);

  const coverAsset = await resolveProfileAsset(sb, restaurant, "cover");
  const avatarAsset = await resolveProfileAsset(sb, restaurant, "avatar");

  // Rotation pro Force-Refresh → keine endlose Wiederholung derselben Reihenfolge.
  const rotateSeed = opts?.force
    ? `${restaurantId}:${ymd(now)}:${Date.now().toString(36)}`
    : `${restaurantId}:${ymd(weekStart)}`;
  const dishes = rotateBySeed(
    prioritizeHeroDishes(dishesRaw, kit.heroAssets),
    `${rotateSeed}:dish`,
  );
  const gallery = rotateBySeed(
    prioritizeHeroGallery(galleryRaw, kit.heroAssets),
    `${rotateSeed}:gallery`,
  );

  // Nur nahe Events mit Cover — keine text-only Event-Posts.
  const events = eventsRaw.filter(
    (e) =>
      Boolean(e.coverUrl) &&
      isEventRelevantSoon(e.startAt, { now, lookaheadDays: 14 }),
  );

  const usableImageCount =
    dishes.length +
    gallery.length +
    (coverAsset ? 1 : 0) +
    (avatarAsset ? 1 : 0) +
    events.length;

  let tasksCreated = false;
  if (usableImageCount < 5) {
    await ensureSocialUploadTaskInDb(sb, restaurantId);
    tasksCreated = true;
  }

  // Feiertage nur im engen Fenster (nicht Maria Himmelfahrt „irgendwo in 14 Tagen“).
  const fromYmd = ymd(now);
  const toYmd = ymd(addDays(now, SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS));
  const holidaysRaw = await listPublicHolidaysInRange(
    restaurant.country?.trim() || "Deutschland",
    fromYmd,
    toYmd,
  );
  const holidays = filterRelevantHolidays(holidaysRaw, {
    now,
    lookaheadDays: SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS,
  });

  const need = clampAutopilotItemCount(
    Math.max(0, kit.weeklyPostTarget - pendingThisWeek.length),
  );
  if (need === 0) {
    return {
      created: 0,
      pending: pendingThisWeek.length,
      tasksCreated,
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  // Ohne eigenes Bildmaterial: keine nackten Text-Vorschläge erzeugen.
  if (usableImageCount === 0) {
    return {
      created: 0,
      pending: pendingThisWeek.length,
      tasksCreated,
      skippedReason: "needs_media",
      aiConfigured,
      aiProvider,
      llmCalls: 0,
      llmApplied: 0,
      caps,
    };
  }

  const usedDishIds = new Set(
    pendingThisWeek
      .map((s) => {
        if (s.slotKind === "menu_dish") {
          return String(s.source.dishId ?? s.asset.sourceId ?? "");
        }
        if (s.asset.source === "menu" && s.asset.sourceId) {
          return String(s.asset.sourceId);
        }
        return "";
      })
      .filter(Boolean),
  );
  const usedGalleryIds = new Set(
    pendingThisWeek
      .map((s) => {
        if (s.asset.source === "gallery" && s.asset.sourceId) {
          return String(s.asset.sourceId);
        }
        return String(s.source.galleryItemId ?? "");
      })
      .filter(Boolean),
  );
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
  const usedProfileIds = new Set(
    pendingThisWeek
      .filter((s) => s.asset.source === "profile" && s.asset.sourceId)
      .map((s) => String(s.asset.sourceId)),
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
  const recentLayouts: SocialFeedLayoutId[] = pendingThisWeek
    .map((s) => {
      const raw = s.source.feedLayout;
      return typeof raw === "string" ? (raw as SocialFeedLayoutId) : null;
    })
    .filter((x): x is SocialFeedLayoutId => Boolean(x));

  const nextPlan = () => {
    const day = daySlots[slotIndex % daySlots.length] ?? 1;
    slotIndex += 1;
    return plannedAtForDay(weekStart, day, 11 + (slotIndex % 2));
  };

  const layoutFor = (slotKind: Draft["slotKind"]): SocialFeedLayoutId => {
    const avoid = recentLayouts.slice(-2);
    const layout = pickFeedLayoutForSlot({
      slotKind,
      preferredLayouts: kit.preferredLayouts,
      avoidLayouts: avoid,
    });
    recentLayouts.push(layout);
    return layout;
  };

  const withOverlay = (
    caption: string,
    source: Record<string, unknown>,
  ): Record<string, unknown> => ({
    ...source,
    overlayLine: overlayLineFromCaption(caption, kit),
  });

  /** Nur Assets mit echter Bild-URL — nie text-only. */
  const pickHeroAsset = (
    prefer: Array<SocialHeroAsset["source"]>,
  ): SocialSuggestionAsset | null => {
    for (const source of prefer) {
      for (const hero of kit.heroAssets) {
        if (hero.source !== source) continue;
        if (hero.source === "profile" && usedProfileIds.has(hero.id)) continue;
        const asset = resolveHeroAsset({
          hero,
          dishes,
          gallery,
          coverAsset,
          avatarAsset,
          usedDishIds,
          usedGalleryIds,
        });
        if (asset?.imageUrl) {
          if (asset.source === "profile" && asset.sourceId) {
            usedProfileIds.add(asset.sourceId);
          }
          return asset;
        }
      }
    }
    return null;
  };

  const takeUnusedProfileAsset = (): SocialSuggestionAsset | null => {
    if (coverAsset?.imageUrl && !usedProfileIds.has("cover")) {
      usedProfileIds.add("cover");
      return coverAsset;
    }
    if (avatarAsset?.imageUrl && !usedProfileIds.has("avatar")) {
      usedProfileIds.add("avatar");
      return avatarAsset;
    }
    return null;
  };

  // 1) Nahe Events mit Cover (Restaurant-Inhalt, aktuell)
  for (const ev of events) {
    if (drafts.length >= need) break;
    if (usedEventIds.has(ev.id)) continue;
    if (!ev.coverUrl) continue;
    usedEventIds.add(ev.id);

    const feedLayout = layoutFor("event");
    const caption = captionForEvent({
      kit,
      restaurantName,
      eventTitle: ev.title,
      whenLabel: formatEventWhen(ev.startAt),
    });
    drafts.push({
      restaurantId,
      status: "pending",
      slotKind: "event",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt: nextPlan(),
      title: ev.title,
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        eventId: ev.id,
        startAt: ev.startAt,
        feedLayout,
        contentReason: "event",
      }),
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

  // 2) Speisekarte + Galerie (Hauptanteil — echte Restaurant-Fotos)
  const pushDishDraft = (): boolean => {
    const dish = pickUnused(dishes, usedDishIds, (d) => d.id);
    if (!dish?.imageUrl) return false;
    const feedLayout = layoutFor("menu_dish");
    const caption = captionForDish({
      kit,
      restaurantName,
      dishName: dish.name,
      dishDescription: dish.description,
    });
    drafts.push({
      restaurantId,
      status: "pending",
      slotKind: "menu_dish",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt: nextPlan(),
      title: dish.name,
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        dishId: dish.id,
        dishName: dish.name,
        ...(dish.description
          ? { dishDescription: dish.description.slice(0, 160) }
          : {}),
        feedLayout,
        contentReason: "menu_dish",
      }),
      asset: {
        imageUrl: dish.imageUrl,
        imageLabel: dish.name,
        source: "menu",
        sourceId: dish.id,
      },
    });
    return true;
  };

  const pushGalleryDraft = (): boolean => {
    const g = pickUnused(gallery, usedGalleryIds, (x) => x.id);
    if (!g?.imageUrl) return false;
    const feedLayout = layoutFor("ambient");
    const caption = captionForAmbient({
      kit,
      restaurantName,
      imageCaption: g.label,
    });
    drafts.push({
      restaurantId,
      status: "pending",
      slotKind: "ambient",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt: nextPlan(),
      title: titleForAmbient(g.label),
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        galleryItemId: g.id,
        imageCaption: g.label,
        feedLayout,
        contentReason: "ambient",
      }),
      asset: {
        imageUrl: g.imageUrl,
        imageLabel: g.label,
        source: "gallery",
        sourceId: g.id,
        storageBucket: "gallery-media",
        storagePath: g.storagePath,
      },
    });
    return true;
  };

  const remainingForMedia = Math.max(0, need - drafts.length);
  // Feiertag-Slot (max 1) + optional Marke reservieren, Rest → Speisekarte/Galerie.
  const reserveHoliday = holidays.length > 0 ? 1 : 0;
  const reserveBrand =
    coverAsset || avatarAsset || kit.heroAssets.some((h) => h.source === "profile")
      ? 1
      : 0;
  const mediaBudget = Math.max(
    0,
    remainingForMedia - Math.min(1, reserveHoliday) - Math.min(1, reserveBrand),
  );
  // Wenn genug Bilder da sind, lieber Media füllen als Reserven ungenutzt lassen.
  const availableDishes = dishes.filter((d) => !usedDishIds.has(d.id)).length;
  const availableGallery = gallery.filter((g) => !usedGalleryIds.has(g.id))
    .length;
  let dishBudget = 0;
  let galleryBudget = 0;
  const mediaTarget = Math.max(
    mediaBudget,
    // Mindestens die Hälfte der restlichen Slots aus Speisekarte/Galerie, wenn vorhanden.
    Math.min(
      remainingForMedia,
      Math.ceil(remainingForMedia * 0.7),
      availableDishes + availableGallery,
    ),
  );

  if (availableDishes > 0 && availableGallery > 0) {
    galleryBudget = Math.min(
      Math.max(1, Math.ceil(mediaTarget / 2)),
      availableGallery,
    );
    dishBudget = Math.min(mediaTarget - galleryBudget, availableDishes);
    const leftover = mediaTarget - dishBudget - galleryBudget;
    if (leftover > 0) {
      const extraGallery = Math.min(leftover, availableGallery - galleryBudget);
      galleryBudget += extraGallery;
      dishBudget += Math.min(
        leftover - extraGallery,
        availableDishes - dishBudget,
      );
    }
  } else if (availableGallery > 0) {
    galleryBudget = Math.min(mediaTarget, availableGallery);
  } else {
    dishBudget = Math.min(mediaTarget, availableDishes);
  }

  let preferGalleryNext = galleryBudget > 0;
  while (drafts.length < need && (dishBudget > 0 || galleryBudget > 0)) {
    let pushed = false;
    if (preferGalleryNext && galleryBudget > 0) {
      pushed = pushGalleryDraft();
      if (pushed) galleryBudget -= 1;
    } else if (dishBudget > 0) {
      pushed = pushDishDraft();
      if (pushed) dishBudget -= 1;
    } else if (galleryBudget > 0) {
      pushed = pushGalleryDraft();
      if (pushed) galleryBudget -= 1;
    }
    if (!pushed) break;
    preferGalleryNext = !preferGalleryNext;
  }

  while (drafts.length < need && pushGalleryDraft()) {
    /* ambient */
  }
  while (drafts.length < need && pushDishDraft()) {
    /* dishes */
  }

  // 3) Höchstens ein naher Feiertag — nur mit echtem Bild (Galerie/Gericht/Profil).
  for (const h of holidays) {
    if (drafts.length >= need) break;
    if (usedHolidayDates.has(h.date)) continue;

    let asset: SocialSuggestionAsset | null = pickHeroAsset([
      "gallery",
      "menu",
      "profile",
    ]);
    if (!asset) {
      const galleryPick = pickUnused(gallery, usedGalleryIds, (g) => g.id);
      if (galleryPick?.imageUrl) {
        asset = {
          imageUrl: galleryPick.imageUrl,
          imageLabel: galleryPick.label,
          source: "gallery",
          sourceId: galleryPick.id,
          storageBucket: "gallery-media",
          storagePath: galleryPick.storagePath,
        };
      } else {
        const dishPick = pickUnused(dishes, usedDishIds, (d) => d.id);
        if (dishPick?.imageUrl) {
          asset = {
            imageUrl: dishPick.imageUrl,
            imageLabel: dishPick.name,
            source: "menu",
            sourceId: dishPick.id,
          };
        } else {
          asset = takeUnusedProfileAsset();
        }
      }
    }

    if (!asset?.imageUrl) break;
    usedHolidayDates.add(h.date);

    const feedLayout = layoutFor("holiday");
    const caption = captionForHoliday({
      kit,
      restaurantName,
      holidayName: h.name,
    });

    drafts.push({
      restaurantId,
      status: "pending",
      slotKind: "holiday",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt: `${h.date}T10:00:00.000Z`,
      title: h.name,
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        date: h.date,
        holidayName: h.name,
        feedLayout,
        contentReason: "holiday",
      }),
      asset,
    });
    break; // max 1 holiday
  }

  // 4) Höchstens ein Marken-Slot — nur mit Cover/Logo, nie reine Schriftkarte.
  if (drafts.length < need) {
    const asset =
      pickHeroAsset(["profile"]) ?? takeUnusedProfileAsset();
    if (asset?.imageUrl) {
      const feedLayout = layoutFor("brand");
      const caption = captionForBrand({ kit, restaurantName });
      drafts.push({
        restaurantId,
        status: "pending",
        slotKind: "brand",
        templateId: feedLayoutToLegacyTemplate(feedLayout),
        plannedAt: nextPlan(),
        title: restaurantName,
        caption,
        platforms: [...kit.publishPlatforms],
        source: withOverlay(caption, {
          kind: "brand",
          feedLayout,
          contentReason: "brand",
        }),
        asset,
      });
    }
  }

  // Media-first: keine Drafts ohne Bild in die DB.
  const mediaDrafts = drafts.filter((d) => Boolean(d.asset.imageUrl));
  drafts.length = 0;
  drafts.push(...mediaDrafts);

  if (drafts.length === 0) {
    return {
      created: 0,
      pending: pendingThisWeek.length,
      tasksCreated,
      skippedReason: "needs_media",
      aiConfigured,
      aiProvider,
      llmCalls: 0,
      llmApplied: 0,
      caps,
    };
  }

  // Template-Captions als Gerüst → ein LLM-Call (Restaurant-Key) für bessere Texte.
  const captionJobs: SocialAutopilotCaptionJob[] = drafts.map((d, index) => {
    const facts: Record<string, string> = { slotKind: d.slotKind };
    if (typeof d.source.dishName === "string") facts.dishName = d.source.dishName;
    if (typeof d.source.dishDescription === "string") {
      facts.dishDescription = d.source.dishDescription;
    }
    if (typeof d.source.holidayName === "string") {
      facts.holidayName = d.source.holidayName;
    }
    if (typeof d.source.date === "string") facts.date = d.source.date;
    if (typeof d.source.eventId === "string") facts.eventId = d.source.eventId;
    if (typeof d.source.startAt === "string") {
      facts.whenLabel = formatEventWhen(String(d.source.startAt));
    }
    if (typeof d.source.imageCaption === "string") {
      facts.imageCaption = d.source.imageCaption;
    }
    if (d.title) facts.title = d.title;
    if (d.asset.imageLabel) facts.imageLabel = d.asset.imageLabel;
    return {
      index,
      slotKind: d.slotKind,
      title: d.title,
      imageLabel: d.asset.imageLabel ?? null,
      facts,
      templateCaption: d.caption,
    };
  });

  const llmOutcome = await rewriteAutopilotCaptionsWithLlm({
    llm: llmRuntime,
    kit,
    restaurantName,
    jobs: captionJobs,
  });

  const applied = applyAutopilotCaptionResults({
    captions: drafts.map((d) => d.caption),
    titles: drafts.map((d) => d.title),
    sources: drafts.map((d) => d.source),
    kit,
    llmResults: llmOutcome.results,
  });

  for (let i = 0; i < drafts.length; i++) {
    drafts[i]!.caption = applied.captions[i] ?? drafts[i]!.caption;
    drafts[i]!.title = applied.titles[i] ?? drafts[i]!.title;
    drafts[i]!.source = applied.sources[i] ?? drafts[i]!.source;
  }

  const created = await insertSocialSuggestionsInDb(sb, drafts);
  const pending = pendingThisWeek.length + created;
  return {
    created,
    pending,
    tasksCreated,
    aiConfigured,
    aiProvider,
    llmCalls: llmOutcome.llmCalls,
    llmApplied: applied.llmApplied,
    caps,
    ...(llmOutcome.ok ? {} : { skippedReason: undefined }),
  };
}
